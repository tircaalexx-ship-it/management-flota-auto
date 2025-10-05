// server.js
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// Mock data - disk-uri
let disks = [
  { id: 1, name: "System Disk", size: 500, type: "SSD" },
  { id: 2, name: "Data Storage", size: 1000, type: "HDD" }
];

// GET /disks - List all disks
app.get('/disks', (req, res) => {
  res.json({
    success: true,
    data: disks,
    count: disks.length
  });
});

// POST /disks - Add new disk
app.post('/disks', (req, res) => {
  const { name, size, type } = req.body;
  
  if (!name || !size || !type) {
    return res.status(400).json({
      success: false,
      error: "Name, size and type are required"
    });
  }

  const newDisk = {
    id: disks.length + 1,
    name,
    size,
    type,
    createdAt: new Date().toISOString()
  };

  disks.push(newDisk);
  
  res.status(201).json({
    success: true,
    data: newDisk
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});