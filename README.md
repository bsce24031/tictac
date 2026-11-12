# TicTac Arena
Dev/prod: `npm install && PORT=3000 npm start` → http://localhost:3000 · health: `/health`
Prod: `npm i -g pm2 && pm2 start server.js --name tictac && pm2 save && pm2 startup`
Nginx (WebSocket-ready) inside your HTTPS server block:
    location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
      proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_read_timeout 86400; }
Env: see .env.example (PORT, CORS_ORIGIN). Rooms are in memory (single server); a restart clears active rooms.
