const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const { query } = require('express');
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
        const paymentsCollection = client.db('resaleProduct').collection('payments');
        const advertiseCollection = client.db('resaleProduct').collection('advertise');

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
            // console.log(result);
            res.send(result)
        })

        // get whether user verified or not by email
        app.get('/users/verified', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await usersCollection.find(query).project({ verified: 1, email: 1 }).toArray()
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

        // get all advertise : general
        app.get('/product/advertise', async (req, res) => {
            const result = await advertiseCollection.find({ status: true }).toArray();
            res.send(result);
        })

        // add avertise for a product: seller
        app.post('/product/advertise', async (req, res) => {
            const product = req.body;
            console.log(product.productId);
            const result = await advertiseCollection.insertOne(product);

            const id = product.productId;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    advertise: true
                }
            }
            const changeAdvertise = await productsCollection.updateOne(filter, updateDoc);

            res.send(result);
        })

        // get products by category id: buyer
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category_id: id, status: true };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })

        // delete product by product id: seller
        app.delete('/product/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        // 
        app.get('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
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
            const id = booking.productId;
            const email = booking.email;
            const query = { productId: id, email: email };
            const alreadyBooked = await bookingCollection.findOne(query);

            if (alreadyBooked) {
                return res.send({ message: 'You already booked this item' })
            }

            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        // all reports : admin
        app.get('/report', async (req, res) => {
            const result = await reportsCollection.find({}).toArray();
            res.send(result);
        })

        // product report to admin : buyer
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

        // delete buyer : admin
        app.delete('/buyer/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // delete seller : admin
        app.delete('/seller/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // delete report : admin
        app.delete('/report/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await reportsCollection.deleteOne(query);
            res.send(result);
        })

        // verify seller badge: admin
        app.post('/seller/verify/:id', async (req, res) => {
            const adminEmail = req.query.email;
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    verified: data.verified
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);

            const emailFilter = { sellerEmail: data.email };
            const updateProductBadge = {
                $set: {
                    verified: true,
                }
            }
            const updateProduct = await productsCollection.updateMany(emailFilter, updateProductBadge);

            res.send(result);
        })


        // payment
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                'payment_method_types': [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            const bookingId = payment.bookingId;
            const filterBooking = { _id: ObjectId(bookingId) };
            const updatedBooking = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedBookingResult = await bookingCollection.updateOne(filterBooking, updatedBooking);

            const productId = payment.productId;
            const filterProduct = { _id: ObjectId(productId) };
            const updateProduct = {
                $set: {
                    advertise: false,
                    status: false
                }
            }
            const updateProductResult = await productsCollection.updateOne(filterProduct, updateProduct);

            const filterProductInBooking = { productId: productId }
            const updateBookedProduct = {
                $set: {
                    status: false,
                }
            }
            const updatedBookedProductResult = await bookingCollection.updateMany(filterProductInBooking, updateBookedProduct);
            const updateAdvertiseResult = await advertiseCollection.updateOne(filterProductInBooking, updateBookedProduct);

            //advertise collection update

            res.send(result);
        })

    }
    finally { }
}
run().catch(err => console.error(err.message))



app.listen(port, () => {
    console.log(`Server running on ${port} port`);
})