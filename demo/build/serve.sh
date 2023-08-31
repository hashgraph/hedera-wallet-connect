#! /bin/sh

npx http-server -p 8080 demo/dist \
	& npx http-server -p 8081 demo/dist \
	& wait
