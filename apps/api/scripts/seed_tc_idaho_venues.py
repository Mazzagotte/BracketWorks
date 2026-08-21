from __future__ import annotations

from app.api.deps import SessionLocal
from app.core.models import TcVenue


VENUES = [
    ("Meridian Bowling Lanes", "324 S Meridian Rd", "Meridian", "ID", "83642", 43.601500, -116.392990),
    ("Nampa Bowl", "485 Caldwell Blvd", "Nampa", "ID", "83651", 43.593470, -116.587310),
    ("Caldwell Bowl", "2121 Blaine St", "Caldwell", "ID", "83605", 43.655360, -116.674540),
    ("Westy's Garden Lanes", "5504 W Alworth St", "Garden City", "ID", "83714", 43.648537, -116.271599),
    ("Emerald Lanes", "4860 W Emerald St", "Boise", "ID", "83706", 43.612270, -116.242120),
    ("Big Al's Meridian", "1900 N Eagle Rd", "Meridian", "ID", "83646", 43.622480, -116.351120),
    ("Pinz Bowling Center at Wahooz", "1385 S Blue Marlin Ln", "Meridian", "ID", "83642", 43.592780, -116.401110),
    ("Boise State University Games Center", "1700 W University Dr", "Boise", "ID", "83725", 43.601790, -116.201680),
    ("The Bowling Alley", "18 N 1st St W", "Homedale", "ID", "83628", 43.617000, -116.934000),
    ("KT's Lanes", "1501 S Washington Ave", "Emmett", "ID", "83617", 43.863035, -116.500141),
]


def main() -> None:
    created = 0
    updated = 0

    with SessionLocal() as db:
        for name, address, city, state, zip_code, latitude, longitude in VENUES:
            venue = db.query(TcVenue).filter(TcVenue.name == name).one_or_none()
            if venue is None:
                venue = TcVenue(name=name)
                db.add(venue)
                created += 1
            else:
                updated += 1

            venue.address_line_1 = address
            venue.city = city
            venue.state = state
            venue.zip = zip_code
            venue.country = "US"
            venue.latitude = latitude
            venue.longitude = longitude

        db.commit()

    print(f"Tournament Central Idaho venues seeded: {created} created, {updated} updated.")


if __name__ == "__main__":
    main()