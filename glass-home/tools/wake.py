#!/usr/bin/env python3
"""Wake a Samsung TV with Wake-on-LAN.

The TV needs Settings > Connection > Network > Expert Settings >
"Power On with Mobile" switched on. Use the MAC address of the network the TV
is on (Wi-Fi or wired); `tvremote.py info` prints the Wi-Fi one.

  TV_MAC=AA:BB:CC:DD:EE:FF TV_IP=192.168.1.50 ./wake.py

Sends the magic packet as broadcast (and to TV_IP if set), three rounds,
because some Samsung sets ignore a single packet.
"""
import os
import socket
import sys
import time

mac = os.environ.get("TV_MAC", "").replace(":", "").replace("-", "")
if len(mac) != 12:
    sys.exit("Set TV_MAC to the TV's MAC address, e.g. TV_MAC=AA:BB:CC:DD:EE:FF ./wake.py")
packet = b"\xff" * 6 + bytes.fromhex(mac) * 16
targets = ["255.255.255.255"]
if os.environ.get("TV_IP"):
    targets.append(os.environ["TV_IP"])

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
for _ in range(3):
    for dest in targets:
        for port in (9, 7):
            try:
                s.sendto(packet, (dest, port))
            except OSError:
                pass
    time.sleep(0.3)
print("wake-on-LAN sent")
