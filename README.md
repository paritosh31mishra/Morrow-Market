# Morrow Market

Morrow Market is a multi-seller marketplace. Buyers can browse products, keep a cart, and place orders. Sellers can list products, manage stock, restock products, and see the order lines for their own products.

## Project structure

```text
Keep-shopping-Ecommerce-website/
|-- .gitignore
|-- README.md
|-- API/
|   |-- .env                 Local settings and secrets (create this; ignored by Git)
|   |-- package.json         API dependencies and start scripts
|   |-- package-lock.json    Exact API dependency versions
|   |-- server.js            Express entry point
|   |-- data.json            Old JSON Server data; the Mongo API does not read it
|   `-- src/
|       |-- config/database.js
|       |-- middleware/auth.js
|       |-- models/User.js
|       |-- models/Product.js
|       |-- models/Order.js
|       `-- routes/
|           |-- authRoutes.js
|           |-- productRoutes.js
|           `-- orderRoutes.js
`-- shopping/
    |-- package.json         React dependencies and start scripts
    |-- package-lock.json    Exact React dependency versions
    |-- postcss.config.js    Connects Tailwind to the CSS build
    |-- tailwind.config.js   Tells Tailwind which React files to scan
    |-- public/
    |   |-- index.html       Browser page and tab title
|   |-- manifest.json    Installed-app metadata
|   |-- product-placeholder.svg Shown when a product image is missing or broken
|   `-- *.jpg, logos, icons   Static images and browser icons
    `-- src/
        |-- index.js         React entry point; loads the global CSS and App
        |-- index.css         Tailwind directives and small global styles
        |-- App.js            Storefront, seller screens, authentication, cart, API calls
        |-- reportWebVitals.js Optional browser performance metrics
        |-- App.css           Old Create React App styles (not imported by the active UI)
        |-- App.test.js       Create React App test file
        |-- setupTests.js     Test environment setup
        |-- user/             Earlier JSON Server buyer screens (not used by current App)
        `-- seller/           Earlier JSON Server seller screens (not used by current App)
```

The active UI is in `shopping/src/App.js`. The older files under `shopping/src/user/` and `shopping/src/seller/` are kept for reference; they are not imported by the active app. `App.css` is leftover styling and is not loaded. `reportWebVitals.js` is an optional Create React App metrics helper imported by `index.js`. `API/data.json` is from the former JSON Server setup and is not used by the MongoDB API.

## Backend startup flow

1. Run `node server.js` from the `API/` folder, or use `npm run dev` there.
2. `API/server.js` loads variables from `API/.env` with `dotenv`. It creates the Express app, enables JSON request bodies and CORS, and mounts the route files under `/api`.
3. It calls `connectDatabase()` from `src/config/database.js`. That file passes `MONGODB_URI` to `mongoose.connect()`.
4. Express starts listening on port `5000` only after MongoDB connects. The health check is `GET http://localhost:5000/api/health`.
5. When requests arrive, route handlers validate input and read or write MongoDB documents through the Mongoose models. Protected routes first pass through `middleware/auth.js`, which validates the JWT and checks the buyer/seller role where required.

The API uses MongoDB Atlas or a local MongoDB server. `API/.env` is local-only and must not be committed. Create it with these settings, then replace `JWT_SECRET` with a private random value. For Atlas, replace the local MongoDB URI with the Atlas connection string and use `morrow-market` as its database name.

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/morrow-market
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:3000
```

## Frontend startup flow

1. Run `npm start` from `shopping/`; Create React App serves the UI on `http://localhost:3000`.
2. `src/index.js` renders `App` and imports `src/index.css`. PostCSS processes the Tailwind directives using `postcss.config.js` and `tailwind.config.js`.
3. `App.js` loads products from `http://localhost:5000/api`, then displays buyer or seller screens based on the signed-in account role.
4. API requests use the JWT from that browser's local storage for protected actions. The cart is also cached in that browser's local storage so it survives a page reload. This is per browser/device; MongoDB remains the shared storage for accounts, products, stock, and orders.
5. The storefront checks product stock in the background while the tab is open. Broken or empty product image URLs fall back to `public/product-placeholder.svg`.

## MongoDB models and collections

Mongoose creates collections from the models when the first document is saved. In the `morrow-market` database, the collections are:

| Model | MongoDB collection | Purpose |
| --- | --- | --- |
| `User` (`src/models/User.js`) | `users` | Buyer and seller details, role, and hashed password |
| `Product` (`src/models/Product.js`) | `products` | Product description, image URL, price, stock, and seller reference |
| `Order` (`src/models/Order.js`) | `orders` | Buyer, delivery address, status, total, and purchased line items |

Order line items are embedded in each order document. No separate cart or order-item collection is currently used.

### What each schema contains

- **User:** `name`, unique `email`, hashed `password`, `role` (`buyer` or `seller`), and optional `phone` and `address`. The password is excluded from normal queries.
- **Product:** `name`, `category`, `description`, optional `image` URL, `price`, available `stock`, and a `seller` reference to a `User`. Stock cannot be negative.
- **Order:** `buyer` reference, `shippingAddress`, `status`, and `total`. Each embedded item stores its product and seller references plus a snapshot of the product name, image, price, and purchased quantity. The snapshot preserves what was bought if a seller later changes or removes a listing.

## API routes

Protected routes require the `Authorization: Bearer <token>` header returned by signup or login.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create a buyer or seller account |
| `POST` | `/api/auth/login` | Public | Verify credentials and return a JWT |
| `GET` | `/api/auth/me` | Signed-in user | Return the current account |
| `GET` | `/api/products` | Public | List products, including sold-out products |
| `GET` | `/api/products/mine` | Seller | List the signed-in seller's products |
| `POST` | `/api/products` | Seller | Add a product |
| `PATCH` | `/api/products/:id/stock` | Product's seller | Add units to the existing stock |
| `DELETE` | `/api/products/:id` | Product's seller | Remove a product |
| `GET` | `/api/orders/mine` | Signed-in user | Buyers see their orders; sellers see their own order lines |
| `POST` | `/api/orders` | Buyer | Check stock, decrement it, and create an order |

## Run locally

1. Start MongoDB locally, or use an Atlas URI in `API/.env`.
2. In `API/`, run `npm install`, create `.env` with the settings above, set `MONGODB_URI` and a private `JWT_SECRET`, then run `npm run dev`.
3. In `shopping/`, run `npm install` and `npm start`.
4. Create a seller account, add a product, then create a buyer account to try browsing and checkout.

Tailwind CSS replaces Bootstrap in the active storefront. The image field accepts a URL; invalid URLs automatically display the local placeholder image.
