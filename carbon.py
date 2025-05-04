from flask import Flask, jsonify, request, session, render_template, g, redirect, url_for, flash
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
from functools import wraps
from datetime import datetime

import os

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
bcrypt = Bcrypt(app)

# CO2 emission factor for UK in kg CO2 per kWh
CO2_PER_KWH = 0.207074


# Get the secret key from env
app.secret_key = os.getenv("FLASK_SECRET_KEY")

# Database configuration
server = os.getenv("DB_SERVER")
database = os.getenv("DB_DATABASE")
username = os.getenv("DB_USERNAME")
password = os.getenv("DB_PASSWORD")
driver = os.getenv("DB_DRIVER")
DATABASE_URL = f"mssql+pyodbc://{username}:{password}@{server}/{database}?driver={driver}"

# Create the database engine
engine = create_engine(DATABASE_URL)

# Session factory
SessionFactory = sessionmaker(bind=engine)

# Before each request: create session
@app.before_request
def before_request():
    g.db_session = SessionFactory()

# After each request: close session
@app.teardown_request
def teardown_request(exception=None):
    db_session = getattr(g, 'db_session', None)
    if db_session:
        db_session.close()

## functions ---------------------------------------------------------------------------------------------
# function to ensure that you can only get to the app page when logged in
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session or "username" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "message": "Authentication required"}), 401
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated_function

# Function for retrieving Types from the database
def getActivityTypes():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT ActivityTypeName FROM ActivityType ORDER BY ActivityTypeName"))
        categories = [row[0] for row in result]
    return categories

def getApplianceTypes():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT Category FROM ApplianceTypes ORDER BY Category"))
        types = [row[0] for row in result]
    return types

def getFoodTypes():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT TypeName FROM FoodType ORDER BY TypeName"))
        types = [row[0] for row in result]
    return types

def getTransportTypes():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT TypeName FROM TransportType ORDER BY TypeName"))
        types = [row[0] for row in result]
    return types



## template routes-----------------------------------------------------------------------------------
@app.route("/login/", methods=["GET"])
def login_page():
    return render_template("login.html")

@app.route("/register/")
def register_page():
    return render_template("register.html")

@app.route("/")
def homepage():
    return render_template("homepage.html")

@app.route("/forgot-password")
def forgot_password_page():
    return render_template("forgot_password.html")



#----------------------------------------------------------------
## Protected routes

@app.route("/menu/")
@login_required
def user_menu():
    return render_template("menu.html", username=session.get("username"))


@app.route("/additem/")
@login_required
def additem():
    categories = getActivityTypes()
    applianceTypes = getApplianceTypes()
    foodTypes = getFoodTypes()
    transportTypes = getTransportTypes()
    return render_template(
        "additem.html",
        categories=categories,
        applianceTypes=applianceTypes,
        foodTypes=foodTypes,
        transportTypes=transportTypes
    )


@app.route("/userlog/<int:page>")
@login_required
def userlog(page=1):
    logs_per_page = 10
    offset = (page - 1) * logs_per_page

    # Updated Query: Filter by current user using UserLog
    query = """
        SELECT al.ActivityLogID, 
               CASE 
                   WHEN at.ActivityTypeName = 'Food' THEN f.Product
                   WHEN at.ActivityTypeName = 'Transport' THEN t.TransportName
                   WHEN at.ActivityTypeName = 'Appliance' THEN a.ApplianceName
               END AS ActivityName,
               al.Co2e, 
               al.LogTime
        FROM ActivityLog al
        JOIN ActivityType at ON al.ActivityTypeID = at.ActivityID
        JOIN UserLog ul ON al.ActivityLogID = ul.ActivityLogID
        LEFT JOIN Food f ON al.ActivityItemID = f.FoodID AND at.ActivityTypeName = 'Food'
        LEFT JOIN Transport t ON al.ActivityItemID = t.TransportID AND at.ActivityTypeName = 'Transport'
        LEFT JOIN Appliance a ON al.ActivityItemID = a.ApplianceID AND at.ActivityTypeName = 'Appliance'
        WHERE ul.UserID = :user_id
        ORDER BY al.LogTime DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    """

    logs = g.db_session.execute(
        text(query),
        {
            "user_id": session["user_id"],
            "limit": logs_per_page,
            "offset": offset
        }
    ).fetchall()

    # Update total log count for pagination to be user-specific
    total_logs = g.db_session.execute(
        text("SELECT COUNT(*) FROM UserLog WHERE UserID = :user_id"),
        {"user_id": session["user_id"]}
    ).fetchone()[0]

    return render_template("userlog.html", logs=logs, page=page, total_logs=total_logs)



@app.route("/viewdata/")
@login_required
def viewdata():
    return render_template("viewdata.html")



# ---------------------------------------------------------------
## API endpoints
# Registration Endpoint
@app.route("/api/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        confirm_password = data.get("confirm_password")

        if not username or not email or not password or not confirm_password:
            return jsonify({"success": False, "message": "Missing fields"}), 400
        
        if password != confirm_password:
            return jsonify({"success": False, "message": "Passwords do not match"}), 400
        
        result = g.db_session.execute(
            text("SELECT COUNT(*) FROM UserDetails WHERE username = :username OR email = :email"),
            {"username": username, "email": email}
        ).fetchone()

        if result[0] > 0:
            return jsonify({"success": False, "message": "Username or email already exists"}), 400

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        hashed_email = bcrypt.generate_password_hash(email).decode('utf-8')

        g.db_session.execute(
            text("INSERT INTO UserDetails (username, email, password) VALUES (:username, :email, :password)"),
            {"username": username, "email": hashed_email, "password": hashed_password}
        )
        g.db_session.commit()

        return jsonify({"success": True, "message": "User registered successfully!"}), 201

    except Exception as e:
        g.db_session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# Login Endpoint
@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"success": False, "message": "Missing fields"}), 400
        
        result = g.db_session.execute(
            text("SELECT UserID, username, password FROM UserDetails WHERE username = :username"),
            {"username": username}
        ).fetchone()

        if not result:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401

        user_ID, username, stored_hashed_password = result

        if not bcrypt.check_password_hash(stored_hashed_password, password):
            return jsonify({"success": False, "message": "Invalid username or password"}), 401

        session["user_id"] = user_ID
        session["username"] = username

        return jsonify({"success": True, "message": "Login successful!"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# Forgotten password Endpoint
@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    try:
        data = request.get_json()
        username = data.get("username")
        email = data.get("email")

        if not username or not email:
            return jsonify({"success": False, "message": "Username and email are required."}), 400

        result = g.db_session.execute(
            text("SELECT email FROM UserDetails WHERE username = :username"),
            {"username": username}
        ).fetchone()

        if not result:
            return jsonify({"success": False, "message": "No such user found."}), 404

        stored_hashed_email = result[0]

        if not bcrypt.check_password_hash(stored_hashed_email, email):
            return jsonify({"success": False, "message": "Email does not match our records."}), 403

        return jsonify({"success": True, "message": "If the details are correct, a password reset link will be sent."}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    
# logout Endpoint
@app.route("/logout/")
def logout():
    session.clear()
    return redirect(url_for("login_page"))

@app.route("/api/items/<activity>/<category>", methods=["GET"])
@login_required
def get_items(activity, category):
    with engine.connect() as connection:
        # ---------------- Appliance ----------------
        if activity == "appliance":
            result = connection.execute(
                text("""
                    SELECT ApplianceName, AverageKWH 
                    FROM Appliance 
                    WHERE ApplianceTypeID = (SELECT TypeID FROM ApplianceTypes WHERE Category = :category)
                """),
                {"category": category}
            )
            items = [{"name": row[0], "wattage": row[1]} for row in result]
            return jsonify(items)

        # ---------------- Transport ----------------
        elif activity == "transport":
            transport_type_map = {"personal": 1, "public": 2}
            transport_type_id = transport_type_map.get(category.lower())

            if not transport_type_id:
                return jsonify({"error": "Invalid transport category"}), 400

            result = connection.execute(
                text("""
                    SELECT TransportName, Co2e, FuelType
                    FROM Transport
                    WHERE TransportTypeID = :type_id
                """),
                {"type_id": transport_type_id}
            )
            items = [{"name": row[0], "co2e_per_mile": row[1], "fuel_type": row[2]} for row in result]
            return jsonify(items)

        # ---------------- Food ----------------
        elif activity == "food":
            result = connection.execute(
            text("""
                SELECT f.Product, f.Co2e
                FROM Food f
                JOIN FoodType ft ON f.FoodTypeID = ft.TypeID
                WHERE ft.TypeName = :category
            """),
            {"category": category}
            )
            items = [{"name": row[0], "co2e_per_kg": row[1]} for row in result]
            return jsonify(items)


        # ---------------- Invalid Activity ----------------
        else:
            return jsonify({"error": "Invalid activity type"}), 400



# log new entry endpoint
@app.route("/api/log-appliance", methods=["POST"])
@login_required
def log_appliance():
    try:
        data = request.get_json()
        user_id = data.get("userID")
        appliance_name = data.get("applianceName")
        usage_time = data.get("usageTime")
        wattage = data.get("wattage")
        log_time = data.get("logTime")

        if not all([user_id, appliance_name, usage_time, wattage, log_time]):
            return jsonify({"success": False, "message": "Missing required fields."}), 400

        # 1. Get ApplianceID
        appliance_result = g.db_session.execute(
            text("SELECT ApplianceID FROM Appliance WHERE ApplianceName = :name"),
            {"name": appliance_name}
        ).fetchone()

        if not appliance_result:
            return jsonify({"success": False, "message": "Appliance not found."}), 404

        appliance_id = appliance_result[0]

        # 2. Calculate Co2e (example calculation)
        co2e = float(usage_time) * float(wattage)  * CO2_PER_KWH

        # 3. Insert into ActivityLog & get new ID
        activity_log_insert = g.db_session.execute(
            text("""
                INSERT INTO ActivityLog (ActivityItemID, ActivityTypeID, Co2e, LogTime)
                OUTPUT INSERTED.ActivityLogID
                VALUES (:item_id, :type_id, :co2e, :log_time)
            """),
            {
                "item_id": appliance_id,
                "type_id": 1,   # Assuming 1 = Appliance in ActivityType
                "co2e": co2e,
                "log_time": log_time
            }
        )

        activity_log_id = activity_log_insert.fetchone()[0]

        # 4. Insert into UserLog
        g.db_session.execute(
            text("""
                INSERT INTO UserLog (UserID, ActivityLogID)
                VALUES (:user_id, :activity_log_id)
            """),
            {
                "user_id": user_id,
                "activity_log_id": activity_log_id
            }
        )

        g.db_session.commit()

        return jsonify({"success": True, "message": "Appliance logged successfully."})

    except Exception as e:
        g.db_session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    
@app.route("/delete_log/<int:log_id>", methods=["POST"])
@login_required
def delete_log(log_id):
    try:
        # Delete from UserLog first (foreign key constraint)
        g.db_session.execute(
            text("DELETE FROM UserLog WHERE ActivityLogID = :log_id"),
            {"log_id": log_id}
        )

        # Then delete from ActivityLog
        g.db_session.execute(
            text("DELETE FROM ActivityLog WHERE ActivityLogID = :log_id"),
            {"log_id": log_id}
        )

        g.db_session.commit()
        flash("Log deleted successfully", "success")
        return redirect(url_for("userlog", page=1))

    except Exception as e:
        g.db_session.rollback()
        flash(f"Error deleting log: {str(e)}", "danger")
        return redirect(url_for("userlog", page=1))

@app.route("/api/log-transport", methods=["POST"])
@login_required
def log_transport():
    try:
        data = request.get_json()
        user_id = data.get("userID")
        transport_name = data.get("transportName")
        distance = data.get("distance")  # in miles
        log_time = data.get("logTime")

        if not all([user_id, transport_name, distance, log_time]):
            return jsonify({"success": False, "message": "Missing required fields."}), 400

        # Get TransportID and Co2e per mile
        transport_result = g.db_session.execute(
            text("SELECT TransportID, Co2e FROM Transport WHERE TransportName = :name"),
            {"name": transport_name}
        ).fetchone()

        if not transport_result:
            return jsonify({"success": False, "message": "Transport type not found."}), 404

        transport_id, co2_per_mile = transport_result

        # Calculate total CO2e
        co2e = float(distance) * float(co2_per_mile)

        # Insert into ActivityLog
        activity_log_insert = g.db_session.execute(
            text("""
                INSERT INTO ActivityLog (ActivityItemID, ActivityTypeID, Co2e, LogTime)
                OUTPUT INSERTED.ActivityLogID
                VALUES (:item_id, :type_id, :co2e, :log_time)
            """),
            {
                "item_id": transport_id,
                "type_id": 2,   # 2 = Transport in your ActivityType table
                "co2e": co2e,
                "log_time": log_time
            }
        )

        activity_log_id = activity_log_insert.fetchone()[0]

        # Link to UserLog
        g.db_session.execute(
            text("""
                INSERT INTO UserLog (UserID, ActivityLogID)
                VALUES (:user_id, :activity_log_id)
            """),
            {"user_id": user_id, "activity_log_id": activity_log_id}
        )

        g.db_session.commit()
        return jsonify({"success": True, "message": "Transport logged successfully!"})

    except Exception as e:
        g.db_session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/log-food", methods=["POST"])
@login_required
def log_food():
    try:
        data = request.get_json()
        user_id = data.get("userID")
        food_name = data.get("foodName")
        quantity = data.get("quantity")  # in kg
        log_time = data.get("logTime")

        if not all([user_id, food_name, quantity, log_time]):
            return jsonify({"success": False, "message": "Missing required fields."}), 400

        food_result = g.db_session.execute(
            text("SELECT FoodID, Co2e FROM Food WHERE Product = :name"),
            {"name": food_name}
        ).fetchone()

        if not food_result:
            return jsonify({"success": False, "message": "Food item not found."}), 404

        food_id, co2_per_kg = food_result

        co2e = float(quantity) * float(co2_per_kg)

        activity_log_insert = g.db_session.execute(
            text("""
                INSERT INTO ActivityLog (ActivityItemID, ActivityTypeID, Co2e, LogTime)
                OUTPUT INSERTED.ActivityLogID
                VALUES (:item_id, :type_id, :co2e, :log_time)
            """),
            {
                "item_id": food_id,
                "type_id": 4,   # 4 = Food in ActivityType
                "co2e": co2e,
                "log_time": log_time
            }
        )

        activity_log_id = activity_log_insert.fetchone()[0]

        g.db_session.execute(
            text("""
                INSERT INTO UserLog (UserID, ActivityLogID)
                VALUES (:user_id, :activity_log_id)
            """),
            {"user_id": user_id, "activity_log_id": activity_log_id}
        )

        g.db_session.commit()
        return jsonify({"success": True, "message": "Food logged successfully!"})

    except Exception as e:
        g.db_session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/activity-data", methods=["GET"])
@login_required
def get_activity_data():
    try:
        start_date = request.args.get("start")
        end_date = request.args.get("end")

        if not start_date or not end_date:
            return jsonify({"success": False, "message": "Start and end dates are required."}), 400

        query = """
            SELECT 
                CAST(al.LogTime AS DATE) AS LogDate,
                at.ActivityTypeName,
                SUM(al.Co2e) AS TotalCo2e
            FROM ActivityLog al
            JOIN ActivityType at ON al.ActivityTypeID = at.ActivityID
            JOIN UserLog ul ON al.ActivityLogID = ul.ActivityLogID
            WHERE ul.UserID = :user_id
              AND CAST(al.LogTime AS DATE) BETWEEN :start_date AND :end_date
              AND at.ActivityTypeName IN ('Appliance', 'Food', 'Transport')
            GROUP BY CAST(al.LogTime AS DATE), at.ActivityTypeName
            ORDER BY LogDate
        """

        results = g.db_session.execute(
            text(query),
            {"user_id": session["user_id"], "start_date": start_date, "end_date": end_date}
        ).fetchall()

        # Process data into Chart.js friendly format
        data = {}
        dates_set = set()

        # Initialize categories
        categories = ['Appliance', 'Food', 'Transport']
        for cat in categories:
            data[cat] = {}

        for row in results:
            log_date = row[0].strftime('%Y-%m-%d')
            category = row[1]
            total_co2e = float(row[2])

            dates_set.add(log_date)
            data[category][log_date] = total_co2e

        sorted_dates = sorted(list(dates_set))

        response = {"dates": sorted_dates}
        for cat in categories:
            # Fill missing dates with 0
            response[cat] = [data[cat].get(date, 0) for date in sorted_dates]

        return jsonify(response)

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
