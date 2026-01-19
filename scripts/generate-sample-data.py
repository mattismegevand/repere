# /// script
# requires-python = ">=3.11"
# dependencies = ["polars>=1.0"]
# ///
"""Generate e-commerce sample data for repere demo."""

import random
from datetime import date, timedelta
from pathlib import Path

import polars as pl

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "sample-data"
SEED = 42

# Product catalog
CATEGORIES = {
    "Electronics": {
        "Smartphones": ["iPhone", "Galaxy", "Pixel", "OnePlus"],
        "Laptops": ["MacBook", "ThinkPad", "XPS", "Surface"],
        "Accessories": ["AirPods", "Charger", "Case", "Cable"],
    },
    "Home": {
        "Kitchen": ["Blender", "Toaster", "Coffee Maker", "Air Fryer"],
        "Furniture": ["Desk", "Chair", "Lamp", "Shelf"],
        "Decor": ["Rug", "Pillow", "Frame", "Plant Pot"],
    },
    "Clothing": {
        "Tops": ["T-Shirt", "Hoodie", "Jacket", "Sweater"],
        "Bottoms": ["Jeans", "Shorts", "Pants", "Skirt"],
        "Footwear": ["Sneakers", "Boots", "Sandals", "Loafers"],
    },
    "Sports": {
        "Equipment": ["Yoga Mat", "Dumbbells", "Jump Rope", "Resistance Band"],
        "Apparel": ["Running Shoes", "Shorts", "Jersey", "Cap"],
        "Outdoor": ["Tent", "Backpack", "Water Bottle", "Sunglasses"],
    },
}

BRANDS = ["Acme", "ZenithCo", "NovaTech", "PrimeLine", "CoreBrand", "EliteMade", "TrueValue", "ProEdge"]
COUNTRIES = ["USA", "Canada", "UK", "Germany", "France", "Australia", "Japan", "Brazil", "India", "Mexico"]
TIERS = ["bronze", "silver", "gold", "platinum"]
STATUSES = ["completed", "completed", "completed", "pending", "shipped", "cancelled", "refunded"]  # weighted

FIRST_NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "William",
               "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Lucas", "Harper", "Henry", "Evelyn", "Alexander"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
              "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]


def generate_products(rng: random.Random) -> pl.DataFrame:
    """Generate ~200 products."""
    products = []
    product_id = 1

    for category, subcats in CATEGORIES.items():
        for subcat, items in subcats.items():
            for item in items:
                brand = rng.choice(BRANDS)
                cost = round(rng.uniform(5, 200), 2)
                margin = rng.uniform(1.2, 2.5)
                products.append({
                    "product_id": product_id,
                    "name": f"{brand} {item}",
                    "category": category,
                    "subcategory": subcat,
                    "brand": brand,
                    "cost": cost,
                    "list_price": round(cost * margin, 2),
                })
                product_id += 1

    return pl.DataFrame(products)


def generate_customers(n: int, rng: random.Random) -> pl.DataFrame:
    """Generate n customers."""
    customers = []
    start_date = date(2020, 1, 1)
    end_date = date(2024, 12, 31)
    date_range = (end_date - start_date).days

    for i in range(1, n + 1):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        signup = start_date + timedelta(days=rng.randint(0, date_range))

        # Some nulls in email (~5%)
        email = None if rng.random() < 0.05 else f"{first.lower()}.{last.lower()}{i}@email.com"

        customers.append({
            "customer_id": i,
            "name": f"{first} {last}",
            "email": email,
            "signup_date": signup,
            "tier": rng.choices(TIERS, weights=[50, 30, 15, 5])[0],
            "country": rng.choice(COUNTRIES),
        })

    return pl.DataFrame(customers)


def generate_orders(n: int, num_products: int, num_customers: int, rng: random.Random) -> pl.DataFrame:
    """Generate n orders."""
    orders = []
    start_date = date(2023, 1, 1)
    end_date = date(2024, 12, 31)
    date_range = (end_date - start_date).days

    for i in range(1, n + 1):
        order_date = start_date + timedelta(days=rng.randint(0, date_range))
        quantity = rng.choices([1, 2, 3, 4, 5], weights=[50, 25, 15, 7, 3])[0]
        unit_price = round(rng.uniform(10, 500), 2)

        # Discount: 30% have no discount (null), rest have 5-25%
        discount = None if rng.random() < 0.3 else round(rng.uniform(0.05, 0.25), 2)

        orders.append({
            "order_id": i,
            "customer_id": rng.randint(1, num_customers),
            "product_id": rng.randint(1, num_products),
            "order_date": order_date,
            "quantity": quantity,
            "unit_price": unit_price,
            "discount": discount,
            "status": rng.choice(STATUSES),
            "shipping_country": rng.choice(COUNTRIES),
        })

    return pl.DataFrame(orders)


def main():
    rng = random.Random(SEED)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating products...")
    products = generate_products(rng)
    products.write_parquet(OUTPUT_DIR / "products.parquet")
    print(f"  → {len(products)} products")

    print("Generating customers...")
    customers = generate_customers(5000, rng)
    customers.write_parquet(OUTPUT_DIR / "customers.parquet")
    print(f"  → {len(customers)} customers")

    print("Generating orders...")
    orders = generate_orders(50000, len(products), len(customers), rng)
    orders.write_parquet(OUTPUT_DIR / "orders.parquet")
    print(f"  → {len(orders)} orders")

    # Clean up old sample data
    old_csv = OUTPUT_DIR / "sales.csv"
    if old_csv.exists():
        old_csv.unlink()
        print("  → Removed old sales.csv")

    print("\nDone! Files written to public/sample-data/")


if __name__ == "__main__":
    main()
