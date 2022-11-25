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
        const categoryCollection = client.db('resaleProduct').collection('categories');

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

        // get all general user: admin 
        app.get('/roleuser', async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // get all seller: admin
        app.get('/roleseller', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // save user to database
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
        app.post('/addproduct', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        // get products by category id: buyer
        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { category_id: id };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })
    }
    finally { }
}
run().catch(err => console.error(err.message))



app.listen(port, () => {
    console.log(`Server running on ${port} port`);
})