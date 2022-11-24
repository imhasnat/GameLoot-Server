const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_KEY);

app.use(express.json())
app.use(cors());

app.get('/', (req, res) => {
    res.send('Server running');
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ovbuiyj.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// const collection = client.db("test").collection("devices");
async function run() {
    try {
        const usersCollection = client.db('resaleProduct').collection('users');







        // save user to database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
    }
    finally { }
}
run().catch(err => console.error(err.message))



app.listen(port, () => {
    console.log(`Server running on ${port} port`);
})