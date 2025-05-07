const connectToDatabase = require('./database'); // Import the MongoDB connection function

connectToDatabase().then((database) => {
  console.log('Database connection established:', database); // Debugging
  db = database;

  // Define routes after the database connection is established
  app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const usersCollection = db.collection('users');

      // Insert the new user
      await usersCollection.insertOne({ username, password: hashedPassword });

      res.json({ message: 'User registered successfully' });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate username error
        return res.status(400).json({ error: 'User already exists' });
      }
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      const usersCollection = db.collection('users');

      // Find the user by username
      const user = await usersCollection.findOne({ username });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Compare the password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate a token
      const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
      res.json({ token });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });
}).catch((err) => {
  console.error('Failed to connect to the database:', err);
  process.exit(1);
});

app.use((req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  next();
});