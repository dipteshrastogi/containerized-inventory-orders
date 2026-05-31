from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import Customer, Order, OrderItem, Product
from app.schemas import (
    CustomerCreate,
    CustomerRead,
    DashboardSummary,
    OrderCreate,
    OrderRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)

settings = get_settings()

app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def get_product_or_404(product_id: int, db: Session) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def get_customer_or_404(customer_id: int, db: Session) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


def commit_or_unique_error(db: Session, entity: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = f"{entity} already exists or violates a data constraint"
        message = str(exc.orig).lower()
        if "sku" in message:
            detail = "Product SKU must be unique"
        if "email" in message:
            detail = "Customer email must be unique"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc


@app.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    commit_or_unique_error(db, "Product")
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db)) -> list[Product]:
    return list(db.scalars(select(Product).order_by(Product.name)).all())


@app.get("/products/{product_id}", response_model=ProductRead)
def read_product(product_id: int, db: Session = Depends(get_db)) -> Product:
    return get_product_or_404(product_id, db)


@app.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)) -> Product:
    product = get_product_or_404(product_id, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(product, field, value)
    commit_or_unique_error(db, "Product")
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)) -> None:
    product = get_product_or_404(product_id, db)
    db.delete(product)
    db.commit()


@app.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    commit_or_unique_error(db, "Customer")
    db.refresh(customer)
    return customer


@app.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return list(db.scalars(select(Customer).order_by(Customer.full_name)).all())


@app.get("/customers/{customer_id}", response_model=CustomerRead)
def read_customer(customer_id: int, db: Session = Depends(get_db)) -> Customer:
    return get_customer_or_404(customer_id, db)


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)) -> None:
    customer = get_customer_or_404(customer_id, db)
    db.delete(customer)
    db.commit()


@app.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)) -> Order:
    customer = get_customer_or_404(payload.customer_id, db)
    requested: dict[int, int] = {}
    for item in payload.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.quantity

    products = db.scalars(select(Product).where(Product.id.in_(requested.keys())).with_for_update()).all()
    product_map = {product.id: product for product in products}
    missing_ids = set(requested) - set(product_map)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product(s) not found: {', '.join(map(str, sorted(missing_ids)))}",
        )

    for product_id, quantity in requested.items():
        product = product_map[product_id]
        if product.quantity_in_stock < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {product.name}. Available: {product.quantity_in_stock}",
            )

    order = Order(customer=customer, status="created", total_amount=Decimal("0.00"))
    total = Decimal("0.00")
    for product_id, quantity in requested.items():
        product = product_map[product_id]
        line_total = product.price * quantity
        product.quantity_in_stock -= quantity
        total += line_total
        order.items.append(
            OrderItem(product=product, quantity=quantity, unit_price=product.price, line_total=line_total)
        )

    order.total_amount = total
    db.add(order)
    db.commit()
    db.refresh(order)
    return get_order_or_404(order.id, db)


def get_order_or_404(order_id: int, db: Session) -> Order:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@app.get("/orders", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)) -> list[Order]:
    return list(
        db.scalars(
            select(Order)
            .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
            .order_by(Order.created_at.desc())
        ).all()
    )


@app.get("/orders/{order_id}", response_model=OrderRead)
def read_order(order_id: int, db: Session = Depends(get_db)) -> Order:
    return get_order_or_404(order_id, db)


@app.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)) -> None:
    order = get_order_or_404(order_id, db)
    db.delete(order)
    db.commit()


@app.get("/dashboard", response_model=DashboardSummary)
def dashboard(db: Session = Depends(get_db)) -> DashboardSummary:
    return DashboardSummary(
        total_products=db.scalar(select(func.count(Product.id))) or 0,
        total_customers=db.scalar(select(func.count(Customer.id))) or 0,
        total_orders=db.scalar(select(func.count(Order.id))) or 0,
        low_stock_products=db.scalar(select(func.count(Product.id)).where(Product.quantity_in_stock <= 5)) or 0,
    )
