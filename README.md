# Pg Realtime

This is a basic pub/sub library for PostgresQL allowing you to create your own realtime service. Built on top of the pg library, it uses the `LISTEN` and `NOTIFY` features of Postgres to surface database events to channels provided by the client.

## Getting started

To get started all you need is a Postgres connection string for the library to connect to your database.

Minimal example:

```
import PostgresNotifier from "pg-realtime";

const notifier = new PostgresNotifier(process.env.DATABASE_URL!);

// Create a channel for database events
const postsChannel = notifier.channel("posts");

// Subscribe to events published on the channel
postsChannel.subscribe((payload: string) => {
  // Do something with the database record
  // Example payload "{"id":"cm3ft8o210000d6uun4x7mfjt","title":"new log","createdAt":"2024-11-13T11:41:03.049Z","updatedAt":null}"
});

...
const post = await db.post.create({
    data: {
        title: title,
    },
});
postsChannel.notify(JSON.stringify(post));
...
```

Full example with a websocket server

```
import express from "express";
import cors from "cors";
import { db } from "prisma/db";
import { Server } from "socket.io";
import http from "http";
import PostgresNotifier from "pg-realtime";
import "dotenv/config";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const port = 8000;

const notifier = new PostgresNotifier(process.env.DATABASE_URL!);
const postsChannel = notifier.channel("posts");

io.on("connection", (socket) => {
  socket.join("posts");
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

postsChannel.subscribe((payload: string) => {
  io.to("posts").emit("post_updated", payload);
});

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/posts", async (req, res) => {
  const posts = await db.post.findMany();
  res.json(posts);
});

app.post("/post", async (req, res) => {
  const { title } = req.body as { title: string };
  const post = await db.post.create({
    data: {
      title: title,
    },
  });

  postsChannel.notify(JSON.stringify(post));
  res.json(post);
});
```
