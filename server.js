
var express = require('express');
var mysql = require('mysql');
tokenizer = require("hx-tokenizer");


var con = mysql.createConnection({
	port: 8889,
    user: 'root',
    password: 'root',
    database: 'library'
});
var text=''
// var query1="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR '|') as name, (select count(*) from book_loans l where l.isbn = b.isbn and l.date_in is null) as not_available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id and (b.title like ? or a.name like ? or b.isbn=?) group by b.isbn, b.title";

var query2="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR '|') as name, (select count(*) from book_loans l where l.isbn = b.isbn and l.date_in is null) as not_available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id and b.isbn=? group by b.isbn, b.title";



con.connect(function(err){
    if (err){
        throw err; return;
    }
    console.log('Connected to DB..');
});

var app = express();
var router = express.Router();
var path = __dirname + "/";


app.set('view engine', 'pug')

router.use(function (req,res,next) {
  console.log("/" + req.method);
  next();
});

router.get("/",function(req,res){
  text=req.query.myname
  
  // console.log(typeof text)
  if(typeof text != "undefined")
  {
    var query1="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR '|') as name, (select count(*) from book_loans l where l.isbn = b.isbn and l.date_in is null) as not_available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id "
    var tokens=[] 
    tokens = tokenizer.tokenize(text);
    if (tokens.length > 0 )
    {
      console.log(tokens)
      query1+="and ("
      var i=0
      while (i<tokens.length)
      {
        // query1+="b.title like "+"'%"+tokens[i]+"%' or a.name like '%"+tokens[i]+"%'"+" or "       
        if (!isNaN(tokens[i]))
        {
          query1+=" b.isbn="+tokens[i]+" or "
          tokens.splice(i, 1);
        }
        else
          i++
      } 
      console.log(tokens)  

      for(var i=tokens.length; i>tokens.length/2 ; i--)
      {
        var str=''
        for (var j=0 ; j<i ; j++)
          str+="%"+tokens[j]+"%"

        query1+="(b.title like '"+str+"' or a.name like '"+str+"') or "  
      }
    }  

    query1+="0=1) group by b.isbn, b.title;"  

    console.log(query1)
  //b.title like ? or a.name like ? or b.isbn=?
    // con.query(query1,['%'+text+'%','%'+text+'%',text],function(err,rows){
    con.query(query1,function(err,rows){    
        if(err)
          throw err;
        else{
          res.render('index', { title: 'Library application', message: rows})
          // res.render('index', { title: 'Library application', temp_msg: text})
        }
    }) 
    
  }
  else
    res.render('index', { title: 'Library application', message: ''})
});

router.get("/check",function(req,res){
  text=req.query.myisbn
  con.query(query2,[text],function(err,rows){
      if(err)
        throw err;
      else{

  res.render('check', { title: 'Library application', message: rows})
      }
  })
});  

// router.post("/",function(req,res){  
//   // res.render('index',{ title: 'Library application', temp_msg: "rows"})
//   text=req.myname
  // con.query(query2,function(err,rows){
  //     if(err)
  //       throw err;
  //     else{
  //       res.render('index', { title: 'Library application', message: rows})
//   //     }
//   })
// });



app.use("/",router);


app.use("*",function(req,res){
  res.sendFile(path + "404.html");
});

app.listen(3000,function(){
  console.log("Live at Port 3000");
});
