const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5555;

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y7qgnfe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create database
    const userCollection = client.db("fitLifeDb").collection('user');
    const trainerCollection = client.db("fitLifeDb").collection('trainer');
    const classCollection = client.db("fitLifeDb").collection('classes');
    const slotCollection = client.db("fitLifeDb").collection('slot');


    // =============== auth related api ======================
    
    // jwt related api
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h'})
      res.send({token})
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      //console.log('inside verify token', req.headers);
      //console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      // verify a token symmetric
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
          return res.status(401).send({message: 'unauthorized access'});
        }
        req.decoded = decoded;
        next();
      });
    }
    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({messsage: 'forbidden access'})
      }
      next();
    }

    // use verify admin after verify token
    const verifyTrainer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isTrainer = user?.role === 'trainer';
      if(!isTrainer){
        return res.status(403).send({messsage: 'forbidden access'})
      }
      next();
    }


    // =============== API for User ======================

    //create
    app.post('/users', async(req, res) => {
      const user = req.body;
      //save user if he or she does not exist in the database
      const query = {email:user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      //console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    //get all users
    app.get('/users', verifyToken, verifyAdmin, async(req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    // delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    

    // make role admin update ------------------------------------------------------------------------
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decoded.email) {
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query);
      //console.log({user});
      let admin = false;
      if (user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })

    

    // Be a trainer related api
    app.post('/betrainer', verifyToken, async(req, res) => {
      const trainer = req.body;
      const query = {email:trainer.email}
      const existingUser = await trainerCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await trainerCollection.insertOne(trainer);
      res.send(result);
    })
    // get all trainer
    app.get('/betrainer', async(req, res) => {
      const result = await trainerCollection.find().toArray();
      res.send(result);
    })
    // get single id
    app.get('/betrainer/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await trainerCollection.findOne(query);
      //console.log(result);
      res.send(result)
    })

    //get by email
    app.get('/trainer/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email:email}
      const result = await trainerCollection.findOne(query);
      console.log(result);
      res.send(result)
    })

    app.patch('/betrainer/:id', verifyToken, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'trainer',
          status: 'approved',          
        }
      }
      const result = await trainerCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/betrainer/role/:id', verifyToken, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'user'
        }
      }
      const result = await trainerCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // make role trainer update ------------------------------------------------------------------------
    app.patch('/betrainer/trainer/:id', verifyToken, verifyTrainer, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'trainer'
        }
      }
      const result = await trainerCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.get('/betrainer/trainer/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      if(email !== req.decoded.email) {
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query);
      //console.log({user});
      let trainer = false;
      if (user){
        trainer = user?.role === 'trainer';
      }
      res.send({trainer});
    })

    // class related api
     //create
    app.post('/class', async(req, res) => {
    const classes = req.body;
    console.log(classes);
    const result = await classCollection.insertOne(classes);
    res.send(result);
    })
    //get all
    app.get('/class', async(req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    //get single class
    app.get('/class/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await classCollection.findOne(query);
      //console.log(result);
      res.send(result)
    })

    // add new slot
    //create
    app.post('/slot', async(req, res) => {
      const slot = req.body;
      const result = await slotCollection.insertOne(slot);
      res.send(result);
    })
    app.get('/slot', async(req, res) => {
      const result = await slotCollection.find().toArray();
      res.send(result);
    })
    app.get('/slot/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await slotCollection.findOne(query);
      res.send(result);
    })
    app.get('/availslot/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email}
      const result = await slotCollection.findOne(query);
      res.send(result);
    })
    app.get('/trainerlot/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email}
      const result = await slotCollection.find(query).toArray();
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})