#!/bin/bash
# Run on the server with sudo: publishes the uploaded build and enables HTTPS.
#   sudo bash ~/deploy/balonca/install-on-server.sh
set -euo pipefail
DOMAIN=balonca.example.com
SRC=/home/youruser/deploy/balonca

mkdir -p /var/www/balonca
rm -rf /var/www/balonca/*
cp -a "$SRC/dist/." /var/www/balonca/
chmod -R a+rX /var/www/balonca

cp "$SRC/nginx-balonca.conf" /etc/nginx/conf.d/balonca.conf
nginx -t
systemctl reload nginx

# HTTPS (adds the 443 block and the http->https redirect to the conf above)
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
nginx -t && systemctl reload nginx
echo "Done: https://$DOMAIN"
