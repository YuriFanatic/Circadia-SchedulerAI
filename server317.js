const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL Connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'California408!', // replace with your MySQL password
    database: 'user_demo'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database.');
});

// Register Endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(query, [username, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({
                    success: false,
                    message: 'Username already exists'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Registration successful'
        });
    });
});

// Login Endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT id, username FROM users WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }

        if (results.length > 0) {
            res.status(200).json({
                success: true,
                message: 'Login successful',
                userId: results[0].id,
                username: results[0].username
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
    });
});

// Create new chat session
app.post('/api/create-chat', (req, res) => {
    const { userId, title } = req.body;
    
    const query = 'INSERT INTO chat_sessions (user_id, chat_title) VALUES (?, ?)';
    db.query(query, [userId, title], (err, result) => {
        if (err) {
            console.error('Error creating chat:', err);
            return res.status(500).json({ error: 'Failed to create chat' });
        }
        res.json({ chat_id: result.insertId });
    });
});

// Save chat message
app.post('/api/save-message', (req, res) => {
    const { chat_id, role, message_content } = req.body;
    
    const query = 'INSERT INTO chat_messages (chat_id, role, message_content) VALUES (?, ?, ?)';
    db.query(query, [chat_id, role, message_content], (err, result) => {
        if (err) {
            console.error('Error saving message:', err);
            return res.status(500).json({ error: 'Failed to save message' });
        }
        res.json({ message_id: result.insertId });
    });
});

// Get user's chat sessions
app.get('/api/get-user-chats/:userId', (req, res) => {
    const userId = req.params.userId;
    
    const query = 'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching chats:', err);
            return res.status(500).json({ error: 'Failed to fetch chats' });
        }
        res.json(results);
    });
});

// Get messages for a specific chat
app.get('/api/get-chat-messages/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    
    const query = 'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC';
    db.query(query, [chatId], (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ error: 'Failed to fetch messages' });
        }
        res.json(results);
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});



// Added three new routes


// Route to extract features for today's schedule:
app.get('/api/features/:userId', (req, res) => {
    const userId = req.params.userId;
    const today = new Date().toISOString().slice(0, 10);

    const query = `
        SELECT      
            COUNT(*) AS num_events,
            AVG(TIMESTAMPDIFF(MINUTE, start_time, end_time)) AS avg_duration,
            TIMESTAMPDIFF(MINUTE, MIN(start_time), MAX(end_time)) AS time_span,
            SUM(is_priority = 1) AS num_priority_events,
            SUM(is_priority = 0) AS num_non_priority_events
        FROM scheduled_events
        WHERE user_id = ? AND DATE(start_time) = ?
    `;

    db.query(query, [userId, today], (err, result) => {
        if (err) {
            console.log('Error computing features:', err);
            return res.status(500).json({ error: 'Failed to compute features' });
        }
        res.json(result[0]);
    });
});

// Route to save an event:
app.post('/api/save-event', (req, res) => {
    const {user_id, title, start_time, end_time, is_priority } = req.body;

    console.log("Incoming event payload:", { user_id, title, start_time, end_time, is_priority });
    if (!title || !start_time || !end_time) {
        console.error("Missing required fields.");
        return res.status(400).json({ error: "Missing required fields" });
    }
    const query = `
        INSERT INTO scheduled_events (user_id, title, start_time, end_time, is_priority)
        VALUES(?, ?, ?, ?, ?)
    `;


    db.query(query, [user_id || 1, title, start_time, end_time, is_priority ? 1 : 0], (err, result) => {
        if (err) {
            console.error("Error saving event:", err);
            return res.status(500).json({ error: "Failed to save event" });
        }
        res.json({ success: true, event_id: result.insertId });
    });
});



// issue might be here when changing the dummy logic
// Compute score 
const { spawn } = require('child_process');

app.post('/api/compute-score', async (req, res) => {
    const { user_id } = req.body;
    const today = new Date().toISOString().slice(0, 10);

    const query = `
        SELECT 
            COUNT(*) AS num_events,
            AVG(TIMESTAMPDIFF(MINUTE, start_time, end_time)) AS avg_duration,
            TIMESTAMPDIFF(MINUTE, MIN(start_time), MAX(end_time)) AS time_span,
            SUM(is_priority = 1) AS num_priority_events,
            SUM(is_priority = 0) AS num_non_priority_events
        FROM scheduled_events
        WHERE user_id = ? AND DATE(start_time) = ?
    `;

    db.query(query, [user_id, today], (err, results) => {
        if (err || results.length === 0) {
            console.error('DB Error:', err);
            return res.status(500).json({ error: 'Failed to extract features' });
        }

        const features = results[0];
        const py = spawn('python3', ['score_model.py']);
        let output = '';

        py.stdout.on('data', (data) => output += data.toString());
        py.stderr.on('data', (err) => console.error("Model Error:", err.toString()));

        py.on('close', () => {
            try {
                const prediction = JSON.parse(output);
                res.json({ score: prediction.score, feedback: prediction.feedback || '' });
            } catch (e) {
                res.status(500).json({ error: 'Invalid model response' });
            }
        });

        py.stdin.write(JSON.stringify(features));
        py.stdin.end();
    });
});
