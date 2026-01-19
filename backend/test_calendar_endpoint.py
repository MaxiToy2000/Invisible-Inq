#!/usr/bin/env python3
"""
Quick test script to verify the calendar endpoint is accessible.
Run this after restarting the server to verify the endpoint works.
"""
import requests
import sys

def test_calendar_endpoint(base_url="http://localhost:8000"):
    """Test the calendar endpoint"""
    url = f"{base_url}/api/calendar"
    
    # Test with section_query parameter
    params = {"section_query": "NIH"}
    
    try:
        print(f"Testing: GET {url}?section_query=NIH")
        response = requests.get(url, params=params, timeout=5)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Success! Retrieved {len(data.get('calendar_items', []))} calendar items")
            return True
        elif response.status_code == 404:
            print("✗ 404 Not Found - The endpoint is not registered.")
            print("  → Please restart the backend server to load the new endpoint.")
            return False
        else:
            print(f"✗ Error: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"✗ Connection Error - Cannot connect to {base_url}")
        print("  → Make sure the backend server is running.")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == "__main__":
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    success = test_calendar_endpoint(base_url)
    sys.exit(0 if success else 1)

