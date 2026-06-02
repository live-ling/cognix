"""
Cognix Backend - Application Entry Point

Usage:
    python app.py          # Start development server on port 8000
    python app.py --port 8080  # Start on custom port
"""

import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Cognix Backend Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload (default: True)")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
