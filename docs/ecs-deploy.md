# ECS Deployment

This project can deploy the Vite build output to Alibaba Cloud ECS with GitHub Actions.
The existing GitHub Pages workflow remains separate; ECS deploys the site at the domain root.

## GitHub Secrets

Add these repository secrets in GitHub:

```text
ECS_HOST=8.160.185.231
ECS_PORT=22
ECS_USER=deploy
ECS_SSH_KEY=<private key for the deploy user>
ECS_DEPLOY_PATH=/var/www/emoar/current
```

Optional but recommended:

```text
ECS_KNOWN_HOSTS=<output of ssh-keyscan -p 22 8.160.185.231>
```

If `ECS_KNOWN_HOSTS` is omitted, the workflow runs `ssh-keyscan` during deployment.

## ECS Setup

Run the server setup commands as a privileged user on the ECS instance.

```bash
sudo yum install -y nginx rsync certbot python3-certbot-nginx
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /var/www/emoar/current
sudo chown -R deploy:deploy /var/www/emoar
sudo install -m 700 -o deploy -g deploy -d /home/deploy/.ssh
sudo vi /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

The deploy user's public key must be added to `/home/deploy/.ssh/authorized_keys`.

Allow the deploy user to reload Nginx without a password:

```bash
sudo visudo
```

Add:

```text
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
```

Paths can vary by image. Confirm them with:

```bash
command -v nginx
command -v systemctl
```

## Nginx Site

Create `/etc/nginx/conf.d/emoar.conf`:

```nginx
server {
    listen 80;
    server_name www.emoar.fun emoar.fun;

    root /var/www/emoar/current;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        application/javascript
        application/json
        image/svg+xml
        text/css
        text/javascript;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /vendor/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Brotli can be enabled too if the installed Nginx build includes the module; at minimum keep gzip on for JavaScript, CSS, JSON, and SVG so the A-Frame/MindAR legacy scripts are not transferred uncompressed.

Validate and start Nginx:

```bash
sudo nginx -t
sudo systemctl enable --now nginx
```

## DNS and HTTPS

In Alibaba Cloud DNS, point these records to the ECS public IP:

```text
www.emoar.fun  A  8.160.185.231
emoar.fun      A  8.160.185.231
```

After DNS resolves, issue the certificate:

```bash
sudo certbot --nginx -d www.emoar.fun -d emoar.fun
```

## Deploy

Push to `main` or manually run the `Build and deploy site to ECS` workflow.
The workflow builds with:

```text
VITE_BASE=/
VITE_APP_VERSION=<GitHub commit SHA>
```

Then it syncs `dist/` to `/var/www/emoar/current/` and reloads Nginx.
The reload uses `sudo -n`, so the GitHub Action fails fast if passwordless sudo is not configured correctly.

## Verification

Check:

```text
https://www.emoar.fun/
https://www.emoar.fun/assets/ar/manifest.json
https://www.emoar.fun/assets/mindar/targets.mind
```

On mobile Safari or Chrome, verify the HTTPS camera permission prompt appears.
