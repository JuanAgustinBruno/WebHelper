const express = require("express");
const app = express();
const path = require('path');
const port = process.env.PORT || 3001;

app.use(express.static('views'))

app.use('/public', express.static('./public'));


app.set('view engine', "ejs");
app.set("views", path.join(__dirname, "/views"))
app.set("public", path.join(__dirname, "/public"))
app.set("html-snippets", path.join(__dirname, "/views/html-snippets"))
app.set("css-snippets", path.join(__dirname, "/views/css-snippets"))
app.set("js-snippets", path.join(__dirname, "/views/js-snippets"))



app.get("/", (req,res) => {
    res.render("index")
});

app.get("/html", (req,res) => {
    res.render("html.ejs")
})
app.get("/css", (req,res) => {
    res.render("css.ejs")
})

app.get("/js", (req,res) => {
    res.render("js.ejs")
})
app.get("/vscode", (req,res) => {
    res.render("vscode.ejs")
})
app.get("/nodejs", (req,res) => {
    res.render("nodejs.ejs")
})
app.get("/home", (req,res) => {
    res.render("office1.ejs")
})

app.get("/eframe", (req,res) => {
    res.render("eframe.ejs")
})



/* const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
 */
app.listen(80, () => {
    console.log('Serving on port 80')
})
