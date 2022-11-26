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

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ovbuiyj.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// const collection = client.db("test").collection("devices");
async function run() {
    try {
        const usersCollection = client.db('resaleProduct').collection('users');
        const productsCollection = client.db('resaleProduct').collection('products');
        const reportsCollection = client.db('resaleProduct').collection('reports');
        const categoryCollection = client.db('resaleProduct').collection('categories');
        const bookingCollection = client.db('resaleProduct').collection('booking');

        // admin verification
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query);
            if (user.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next();
        }

        // seller verification
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query);
            if (user.role !== 'seller') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next();
        }

        // jwt token assign on each login or signin
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '72h' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' });
        })

        // get user role by email
        app.get('/users/role', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await usersCollection.find(query).project({ role: 1 }).toArray()
            res.send(result)
        })

        // get whether user verified or not by email
        app.get('/users/verified', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await usersCollection.find(query).project({ verified: 1 }).toArray()
            res.send(result)
        })

        // save all user to database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // get all categories
        app.get('/categories', async (req, res) => {
            const result = await categoryCollection.find({}).toArray();
            res.send(result);
        })

        // get product by seller email: seller
        app.get('/products', async (req, res) => {
            const email = req.query.email;
            const query = { sellerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })

        // add product: seller
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        // get products by category id: buyer
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })

        // delete product by product id
        app.delete('/products/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        // get all orders: buyer
        app.get('/booking', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const booking = await bookingCollection.find(query).toArray();
            res.send(booking);
        })

        // add booking for a buyer: buyer
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        // all reports
        app.get('/report', async (req, res) => {
            const result = await reportsCollection.find({}).toArray();
            res.send(result);
        })

        // product report to admin
        app.post('/report', async (req, res) => {
            const product = req.body;
            const result = await reportsCollection.insertOne(product);
            res.send(result);
        })

        // get all general user: admin 
        app.get('/role/buyers', async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // get all seller: admin
        app.get('/role/sellers', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })


    }
    finally { }
}
run().catch(err => console.error(err.message))



app.listen(port, () => {
    console.log(`Server running on ${port} port`);
})