import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import { fileURLToPath } from 'url';

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book-login",
  password: "sweta@176",
  port: 5432,
});

const app = express();
const port = 3000;

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Convert __dirname to ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

let notes = " ";
let description = " ";
let user = " ";

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);

    if (result.rows.length > 0) {
      res.render("register.ejs", { error: "Email already registered" });
    } else {
      await db.query("INSERT INTO users (email, password) VALUES ($1, $2)", [username, password]);
      res.render("login.ejs");
    }
  } catch (err) {
    console.error("Error executing query", err.stack);
    res.render("register.ejs", { error: "An error occurred, please try again" });
  }
});

app.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  user = username;

  try {
    const result = await db.query("SELECT password FROM users WHERE email = $1", [username]);

    if (result.rows.length > 0 && result.rows[0].password === password) {
      res.redirect("/index");
    } else {
      res.render("login.ejs", { error: "Invalid email or password" });
    }
  } catch (err) {
    console.error("Error executing query", err.stack);
    res.render("login.ejs", { error: "An error occurred, please try again" });
  }
});

app.get("/index", async (req, res) => {
  try {
    const result2 = await db.query("SELECT id FROM users WHERE email = $1", [user]);
    console.log("User Query Result:", result2.rows);
    console.log(user);

    if (result2.rows.length > 0) {
      const userId = result2.rows[0].id;
      const result = await db.query("SELECT * FROM books WHERE user_id = $1", [userId]);
      const books = result.rows;
      console.log("Books Query Result:", books);

      res.render("index.ejs", {
         book: books,
         id:userId,
         ui:user
         });
    } else {
      res.render("index.ejs", { book: [] });
    }
  } catch (error) {
    console.error("Error fetching books:", error.message);
    res.render("index.ejs", { error: error.message, book: [] });
  }
});

app.get("/add", (req, res) => {
  res.render("add.ejs");
});

app.post("/new", async (req, res) => {
  let title = req.body.book;
  let rating = req.body.rating;
  notes = req.body.theory;

  try {
    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}`);
    const result = response.data;

    if (result.items && result.items.length > 0) {
      const bookInfo = result.items[0].volumeInfo;
      description = bookInfo.description || 'Description not available';
      let thumbnailUrl = bookInfo.imageLinks?.thumbnail || 'No image available';
      let industryIdentifiers = bookInfo.industryIdentifiers || [];
      let authors = bookInfo.authors || ['Unknown author'];
      let authorName = authors[0];
      let isbn_13 = industryIdentifiers.find(id => id.type === 'ISBN_13')?.identifier || 'N/A';

      const userIdResult = await db.query("SELECT id FROM users WHERE email = $1", [user]);
      const userId = userIdResult.rows[0].id;

      await db.query("INSERT INTO books (title, author, description, notes, rating, image, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
        title, authorName, description, notes, rating, thumbnailUrl, userId
      ]);

      res.redirect("/index");
    } else {
      throw new Error("No book found with the given title");
    }
  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("index.ejs", {
      error: error.message,
    });
  }
});

app.post("/notes", async (req, res) => {
  let id = req.body.read;
  const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);

  if (result.rows.length !== 0) {
    const data = result.rows[0];
    res.render("notes.ejs", {
      item: data
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

