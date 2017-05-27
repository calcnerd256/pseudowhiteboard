#!/usr/bin/env bash
ifconfig | grep "inet addr" | grep -v 127.0.0.1 | sed "s/ /\n/g" | grep addr | sed "s/.*://"
