const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
mongoose.connect('mongodb://localhost/chat-app', { useNewUrlParser: true, useUnifiedTopology: true });

// Define models
const User = require('./models/User');
const ChatRoom = require('./models/ChatRoom');
const Message = require('./models/Message');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.post('/register', async (req, res) => {
  try {
    const user = new User(req.body);
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    await user.save();
    res.json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
    } else {
      const isValid = await bcrypt.compare(req.body.password, user.password);
      if (!isValid) {
        res.status(401).json({ message: 'Invalid email or password' });
      } else {
        const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
      }
    }
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('New connection');

  // Join chat room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`Joined room ${roomId}`);
  });

  // Send message
  socket.on('sendMessage', (message) => {
    const chatRoom = ChatRoom.findById(message.roomId);
    if (chatRoom) {
      const newMessage = new Message(message);
      newMessage.save();
      io.in(message.roomId).emit('newMessage', newMessage);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Disconnected');
  });
});

// Start server
const port = 3000;
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
