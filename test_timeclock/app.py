import streamlit as st
import uuid
from datetime import datetime
import pandas as pd
from db_config import get_connection
from utils import find_customer_from_location
from streamlit_geolocation import streamlit_geolocation
from streamlit_cookies_controller import CookieController

# Set page config must be the first Streamlit command
st.set_page_config(
    page_title="Time Clock",
    layout="centered",
    page_icon="⏰",
    initial_sidebar_state="collapsed"
)

# Initialize cookie controller
cookies = CookieController()

# Simple, clean CSS
st.markdown("""
<style>
    /* Main container */
    .main {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }
    
    /* Header styling */
    .header {
        text-align: center;
        margin-bottom: 2rem;
    }
    
    /* Card styling */
    .card {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        margin: 1rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    /* Status message styling */
    .status-message {
        text-align: center;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 8px;
        background: #f8f9fa;
    }
    
    /* Button styling */
    .stButton > button {
        width: 100%;
        padding: 0.75rem;
        border-radius: 8px;
        background: #007bff;
        color: white;
        border: none;
    }
    
    .stButton > button:hover {
        background: #0056b3;
    }
    
    /* Input field styling */
    .stTextInput > div > div > input {
        border-radius: 8px;
        padding: 0.75rem;
    }
    
    /* Map container styling */
    .map-container {
        border-radius: 8px;
        overflow: hidden;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# Main container
st.markdown('<div class="main">', unsafe_allow_html=True)

# Header
st.markdown("""
<div class="header">
    <img src="https://vdrs.com/wp-content/uploads/2022/08/VDRS-lockup-mod-8-19-22-350.png" style="max-width: 300px; display: block; margin: 0 auto;">
    <h1 style="margin-top: 1rem;">Time Clock</h1>
</div>
""", unsafe_allow_html=True)

# Device identification
stored_device_id = cookies.get("device_id")  
device_id = stored_device_id or str(uuid.uuid4())
if not stored_device_id:
    cookies.set("device_id", device_id)

# Get subcontractor name
st.markdown('<div class="card">', unsafe_allow_html=True)
sub = st.text_input("Subcontractor Name", placeholder="Enter subcontractor name")
st.markdown('</div>', unsafe_allow_html=True)

if not sub:
    st.error("Please enter your subcontractor name")
    st.stop()

# User registration check
try:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT Employee, Number FROM SubContractorEmployees WHERE Cookies = ?", device_id)
            user_data = cursor.fetchone()
            
            if user_data:
                st.session_state.update({
                    "registered": True,
                    "user_name": user_data[0],
                    "user_number": user_data[1]
                })
                
                # Check for active sessions by phone number
                cursor.execute("""
                    SELECT TOP 1 ClockIn FROM TimeClock 
                    WHERE Number = ? AND ClockOut IS NULL 
                    ORDER BY ClockIn DESC
                """, user_data[1])
                active_session = cursor.fetchone()
                
                if active_session:
                    st.markdown(f'<div class="status-message">⏱️ Active session: Clocked in since <span class="time-highlight">{active_session[0]}</span></div>', unsafe_allow_html=True)
                    st.session_state["clocked_in"] = True
                else:
                    st.session_state["clocked_in"] = False
                
                st.markdown(f'<div class="status-message">✅ Welcome back, {user_data[0]}!</div>', unsafe_allow_html=True)
            else:
                st.session_state["registered"] = False
except Exception as e:
    st.error(f"Database error: {str(e)}")
    st.session_state["registered"] = False

# Location handling
if "fetch_location" not in st.session_state:
    st.session_state["fetch_location"] = True

if st.session_state.get("fetch_location"):
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.info("Please share your location")
    location = streamlit_geolocation()

    if location and isinstance(location, dict) and 'latitude' in location and 'longitude' in location:
        lat = location['latitude']
        lon = location['longitude']
        
        if lat and lon:
            st.session_state.update({
                "lat": lat,
                "lon": lon,
                "lat_float": float(lat),
                "lon_float": float(lon)
            })
            
            st.markdown(f'<div class="status-message">Location: {lat}, {lon}</div>', unsafe_allow_html=True)
            st.markdown('<div class="map-container">', unsafe_allow_html=True)
            st.map(pd.DataFrame([{"lat": lat, "lon": lon}]))
            st.markdown('</div>', unsafe_allow_html=True)
            
            try:
                customer = find_customer_from_location(st.session_state["lat_float"], st.session_state["lon_float"])
                if not customer:
                    st.error("❌ Not a valid job site.")
                    st.stop()
                
                st.session_state["customer"] = customer
                st.markdown(f'<div class="status-message">🛠️ Work Site: {customer}</div>', unsafe_allow_html=True)

                # Main workflow
                if st.session_state.get("registered"):
                    if st.session_state.get("clocked_in"):
                        # Clock Out UI
                        st.markdown('<div class="card">', unsafe_allow_html=True)
                        st.markdown('<div class="status-message">⏱️ Current Status</div>', unsafe_allow_html=True)
                        st.markdown(f'<div class="status-message">Active session: Clocked in since <span class="time-highlight">{active_session[0]}</span></div>', unsafe_allow_html=True)
                        if st.button("🚪 Clock Out", key="clock_out"):
                            with get_connection() as conn:
                                with conn.cursor() as cursor:
                                    now = datetime.now()
                                    cursor.execute("""
                                        UPDATE TimeClock SET ClockOut = ? 
                                        WHERE Number = ? AND ClockOut IS NULL
                                    """, (now, st.session_state["user_number"]))
                                    conn.commit()
                                    st.session_state["clocked_in"] = False
                                    st.markdown(f'<div class="status-message">👋 Clocked out at <span class="time-highlight">{now.strftime("%H:%M:%S")}</span></div>', unsafe_allow_html=True)
                                    st.rerun()
                        st.markdown('</div>', unsafe_allow_html=True)
                    else:
                        # Clock In UI
                        st.markdown('<div class="card">', unsafe_allow_html=True)
                        st.markdown('<div class="status-message">⏱️ Current Status</div>', unsafe_allow_html=True)
                        st.markdown('<div class="status-message">Not Clocked In</div>', unsafe_allow_html=True)
                        if st.button("⏱️ Clock In", key="clock_in"):
                            with get_connection() as conn:
                                with conn.cursor() as cursor:
                                    now = datetime.now()
                                    cursor.execute("""
                                        INSERT INTO TimeClock (SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie)
                                        VALUES (?, ?, ?, ?, ?, ?, ?)
                                    """, (sub, st.session_state["user_name"], st.session_state["user_number"], 
                                        now, st.session_state["lat_float"], st.session_state["lon_float"], device_id))
                                    conn.commit()
                                    st.session_state["clocked_in"] = True
                                    st.markdown(f'<div class="status-message">✅ Clocked in at <span class="time-highlight">{now.strftime("%H:%M:%S")}</span></div>', unsafe_allow_html=True)
                                    st.balloons()
                                    st.rerun()
                        st.markdown('</div>', unsafe_allow_html=True)
                else:
                    # New User Registration
                    st.markdown('<div class="card">', unsafe_allow_html=True)
                    st.markdown('<div class="status-message">📝 New User Registration</div>', unsafe_allow_html=True)
                    col1, col2 = st.columns(2)
                    with col1:
                        number = st.text_input("📱 Mobile Number", placeholder="Enter your phone number...", key="phone_input")
                    
                    if number:
                        with get_connection() as conn:
                            with conn.cursor() as cursor:
                                # Check existing number
                                cursor.execute("""
                                    SELECT Employee, Cookies 
                                    FROM SubContractorEmployees 
                                    WHERE Number = ?
                                """, number)
                                existing = cursor.fetchone()
                                
                                if existing:
                                    # Update device ID and check sessions
                                    cursor.execute("""
                                        UPDATE SubContractorEmployees 
                                        SET Cookies = ? 
                                        WHERE Number = ?
                                    """, (device_id, number))
                                    conn.commit()
                                    
                                    # Check for existing session
                                    cursor.execute("""
                                        SELECT TOP 1 ClockIn FROM TimeClock 
                                        WHERE Number = ? AND ClockOut IS NULL
                                    """, number)
                                    active_session = cursor.fetchone()
                                    
                                    st.session_state.update({
                                        "registered": True,
                                        "user_name": existing.Employee,
                                        "user_number": number,
                                        "clocked_in": bool(active_session)
                                    })
                                    st.rerun()
                                else:
                                    with col2:
                                        name = st.text_input("🧑 Full Name", placeholder="Enter your full name...", key="name_input")
                                    if name and st.button("✅ Register & Clock In", key="register"):
                                        now = datetime.now()
                                        cursor.execute("""
                                            INSERT INTO SubContractorEmployees (SubContractor, Employee, Number, Cookies)
                                            VALUES (?, ?, ?, ?)
                                        """, (sub, name, number, device_id))
                                        cursor.execute("""
                                            INSERT INTO TimeClock (SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie)
                                            VALUES (?, ?, ?, ?, ?, ?, ?)
                                        """, (sub, name, number, now, 
                                            st.session_state["lat_float"], st.session_state["lon_float"], device_id))
                                        conn.commit()
                                        st.session_state.update({
                                            "registered": True,
                                            "user_name": name,
                                            "user_number": number,
                                            "clocked_in": True
                                        })
                                        st.markdown(f'<div class="status-message">✅ Registered and clocked in at <span class="time-highlight">{now.strftime("%H:%M:%S")}</span></div>', unsafe_allow_html=True)
                                        st.balloons()
                                        st.rerun()
                    st.markdown('</div>', unsafe_allow_html=True)
            except Exception as e:
                st.error(f"Database error: {str(e)}")
    st.markdown('</div>', unsafe_allow_html=True)

# Handle existing location data
elif "lat" in st.session_state and "lon" in st.session_state:
    st.markdown(f'<div class="status-message">📌 Your Location: {st.session_state["lat"]}, {st.session_state["lon"]}</div>', unsafe_allow_html=True)
    st.map(pd.DataFrame([{"lat": st.session_state["lat"], "lon": st.session_state["lon"]}]))
    
    if "customer" in st.session_state:
        st.markdown(f'<div class="status-message">🛠️ Work Site: {st.session_state["customer"]}</div>', unsafe_allow_html=True)

    # Handle clock in/out with existing location
    if st.session_state.get("registered"):
        if st.session_state.get("clocked_in"):
            st.markdown('<div class="status-message">⏱️ Current Status: Clocked In</div>', unsafe_allow_html=True)
            if st.button("🚪 Clock Out"):
                with get_connection() as conn:
                    with conn.cursor() as cursor:
                        now = datetime.now()
                        cursor.execute("""
                            UPDATE TimeClock SET ClockOut = ? 
                            WHERE Number = ? AND ClockOut IS NULL
                        """, (now, st.session_state["user_number"]))
                        conn.commit()
                        st.session_state["clocked_in"] = False
                        st.markdown(f'<div class="status-message">👋 Clocked out at <span class="time-highlight">{now.strftime("%H:%M:%S")}</span></div>', unsafe_allow_html=True)
                        st.rerun()
        else:
            st.markdown('<div class="status-message">⏱️ Current Status: Not Clocked In</div>', unsafe_allow_html=True)
            if st.button("⏱️ Clock In"):
                with get_connection() as conn:
                    with conn.cursor() as cursor:
                        now = datetime.now()
                        cursor.execute("""
                            INSERT INTO TimeClock (SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (sub, st.session_state["user_name"], st.session_state["user_number"], 
                            now, st.session_state["lat_float"], st.session_state["lon_float"], device_id))
                        conn.commit()
                        st.session_state["clocked_in"] = True
                        st.markdown(f'<div class="status-message">✅ Clocked in at <span class="time-highlight">{now.strftime("%H:%M:%S")}</span></div>', unsafe_allow_html=True)
                        st.balloons()
                        st.rerun()

else:
    st.markdown('<div class="status-message">⌛</div>', unsafe_allow_html=True)

# Close main container
st.markdown('</div>', unsafe_allow_html=True)
