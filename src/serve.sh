#!/usr/bin/env bash
nodejs ./serve.js 8080 "$(sudo ./ssid.sh)" "$(sudo ./ip.sh | head -1)"
