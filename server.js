const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep track of the items and their prices
const inventory = {
  item1: 10,
  item2: 20,
  item3: 30,
  // ...
};

// Keep track of the items scanned by each client
const esp32Carts = {};
const billingCounterCarts = {};

// Store a reference to the billing counter client
let billingCounterClient = null;

// Listen for new WebSocket connections
wss.on("connection", (ws, req) => {
  console.log("Client connected");

  // Check if the client is the billing counter client
  const isBillingCounter = req.url.includes("client-type=Billing-Counter");
  if (isBillingCounter) {
    console.log("Billing counter client connected");
    billingCounterClient = ws;
    return;
  }

  // Handle messages from the ESP32 client
  ws.on("message", (data) => {
    const rfid = data.toString();
    const item = inventory[rfid];
    if (item) {
      // Add the item to the client's cart
      if (!esp32Carts[ws]) {
        esp32Carts[ws] = {};
      }
      if (!esp32Carts[ws][rfid]) {
        esp32Carts[ws][rfid] = {
          name: `Item ${rfid}`,
          price: item,
          quantity: 1,
        };
      } else {
        esp32Carts[ws][rfid].quantity++;
      }
      console.log(`ESP32 client scanned item ${rfid}`);
      // Calculate the bill and send it to the client
      const items = Object.values(esp32Carts[ws]);
      const subtotal = items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      );
      const tax = subtotal * 0.1;
      const total = subtotal + tax;
      const bill = { items, subtotal, tax, total };
      ws.send(JSON.stringify(bill));

      // Broadcast the scanned item data to the billing counter client
      if (billingCounterClient) {
        billingCounterClient.send(JSON.stringify(bill));
      }
    }
  });

  // Handle disconnections of the ESP32 client
  ws.on("close", () => {
    console.log("ESP32 client disconnected");
    delete esp32Carts[ws];
  });
});

// Serve static files
app.use(express.static("public"));

// Start server
server.listen(3000, () => {
  console.log("Server started on port 3000");
});
