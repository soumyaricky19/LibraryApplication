
var express = require('express');
var mysql = require('mysql');
tokenizer = require("hx-tokenizer");
var sleep = require('system-sleep');

var con = mysql.createConnection({
	port: 8889,
    user: 'root',
    password: 'root',
    database: 'library'
});

// var query1="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR '|') as name, (select count(*) from book_loans l where l.isbn = b.isbn and l.date_in is null) as not_available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id and (b.title like ? or a.name like ? or b.isbn=?) group by b.isbn, b.title";



var app = express();
var router = express.Router();
var path = __dirname + "/";


app.set('view engine', 'pug')

router.use(function (req,res,next) {
  console.log("/" + req.method);
  next();
});

con.connect(function(err){
    if (err){
        throw err; return;
    }
    console.log('Connected to DB..');
  });
  

router.get("/",function(req,res){
  var str=req.query.mytext
  // console.log(str)
  // console.log(str.length)

  if( str != undefined && str != '')
  {
    var text=str.trim()
    // console.log("preparing query ")
    var query1="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR ' , ') as name, b.available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id "
    var tokens=[] 
    tokens = tokenizer.tokenize(text);
    if (tokens.length > 0 )
    {
      // console.log(tokens)
      query1+="and ("
      var i=0
      while (i<tokens.length)
      {
        // query1+="b.title like "+"'%"+tokens[i]+"%' or a.name like '%"+tokens[i]+"%'"+" or "       
        if (!isNaN(tokens[i]))
        {
          query1+=" b.isbn='"+tokens[i]+"' or "
          tokens.splice(i, 1);
        }
        else
          i++
      // console.log(tokens)  
      } 
      

      for(var l=tokens.length; l>tokens.length/2 ; l--)
      { 
        // console.log(l)
        for (var i=0 ; i<tokens.length-l+1 ; i++)
        {
          var j=i+l
          var str=''
          for (var k=i;k<j;k++)
            str+="%"+tokens[k]+"%"
          
          console.log(str)
          query1+="(b.title like '"+str+"' or a.name like '"+str+"') or "  
        }
      }
    }  

    query1+="0=1) group by b.isbn, b.title;"  

    // console.log(query1)
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
    res.render('index', { title: 'Library application'})
});

router.get("/checkout",function(req,res){
  var txn_message
  var card_id=req.query.mycard
  var isbn= req.query.myisbn
  var temp_rows
  // console.log("Submit flag: "+req.query.submit_flag)
  var query2="select b.isbn, b.title, GROUP_CONCAT(a.name SEPARATOR ' , ') as name, b.available from book b ,authors a, book_authors ba where  b.isbn = ba.isbn and a.author_id = ba.author_id and b.isbn=? group by b.isbn, b.title";
  
  if(req.query.submit_flag != '1')
  {
    console.log("First time")
    con.query(query2,[isbn],function(err,rows)
    {
      if(err)
        throw err;
      else
      {
        res.render('checkout', { title: 'Library application', message: rows})
      }
    }) 
  }
  else
  {
    var query3='select available from book where isbn=?'
    var query4='select num_books_issued from borrower where card_id=?'
    var query5='insert into book_loans (isbn,card_id,date_out,due_date) values (?,?,date(now()),date(date_add(now(),interval 14 day)));'
    var loan_id
    var query6='update book set available=available-1 where isbn=?'
    var query7='update borrower set num_books_issued=num_books_issued+1 where card_id=?'
    console.log("Txn starts")
    con.query(query3,[isbn],function(err,rows)
    {
      if(rows[0].available <= 0)
      {
        txn_message="Sorry! Book not available"
        console.log(txn_message)
        con.query(query2,[isbn],function(err,rows)
        {
          if(err)
            throw err;
          else
          {
            res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
          }
        })
      }
      else
      {
        con.query(query4,[card_id],function(err,rows)
        {
          if(rows[0] == undefined)
          {
            txn_message="Incorrect card ID"
            console.log("txn_message")
            con.query(query2,[isbn],function(err,rows)
            {
              if(err)
                throw err;
              else
              {
                res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
              }
            })
          }
          else
          {
            var num=rows[0].num_books_issued
            console.log(num+" books")
            if (num <3)
            {
              con.query(query5,[isbn,card_id],function(err,rows)
              {
                if(err)
                {
                  txn_message="DB error"
                  console.log("query5 failed")
                  con.query(query2,[isbn],function(err,rows)
                  {
                    if(err)
                      throw err;
                    else
                    {
                      res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
                    }
                  })
                }
                else
                {  
                  console.log("Loan ID: "+rows.insertId+" inserted")
                  con.query(query6,[isbn],function(err,rows)
                  {
                    if(err)
                    {
                      txn_message="DB error"
                      console.log("query6 failed")
                      con.query(query2,[isbn],function(err,rows)
                      {
                        if(err)
                          throw err;
                        else
                        {
                          res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
                        }
                      })
                    }
                    else
                    {  
                      con.query(query7,[card_id],function(err,rows)
                      {
                        if(err)
                        {
                          txn_message="DB error"
                          console.log("query7 failed")
                          con.query(query2,[isbn],function(err,rows)
                          {
                            if(err)
                              throw err;
                            else
                            {
                              res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
                            }
                          })
                        }
                        else
                        {  
                          txn_message="SUCCESSFUL checkout!"
                          console.log(txn_message)
                          con.query(query2,[isbn],function(err,rows)
                          {
                            if(err)
                              throw err;
                            else
                            {
                              res.render('checkout', { title: 'Library application', txn_msg:txn_message})
                            }
                          })
                        }  
                      })
                    }
                  })
                }   
              })
            }
            else
            {
              console.log("Already issued")
              txn_message="Already issued "+num+" books"
              con.query(query2,[isbn],function(err,rows)
              {
                if(err)
                  throw err;
                else
                {
                  res.render('checkout', { title: 'Library application', message: rows, txn_msg:txn_message})
                }
              })
            }
          }
        })
      }
    }) 
  }
});

router.get("/checkin",function(req,res){
  var str=req.query.mytext
  var submit_flag=req.query.submit_flag
  if( str != undefined && str != '')
  {   
    var selected_flag=req.query.myselect
    
    // console.log(str)
    // console.log(selected_flag)
    var query
    if(selected_flag == 1)
    {
      query='select a.card_id,b. isbn,a.fname,a.lname from borrower a,book_loans b where a.card_id=b.card_id and a.card_id=? and b.date_in is null'
      con.query(query,[str],function(err,rows){  
          console.log(query,[str]) 
          res.render('checkin', { title: 'Library application', message: rows})
      })
    }
    else if (selected_flag == 2)
    {
      query='select a.card_id,b.isbn,a.fname,a.lname from borrower a,book_loans b where a.card_id=b.card_id and b.isbn=? and b.date_in is null'
      con.query(query,[str],function(err,rows){    
          console.log(query,[str])
          res.render('checkin', { title: 'Library application', message: rows})
      })
    }
    else if (selected_flag == 3)
    {
      var text=str.trim()
      tokens = tokenizer.tokenize(text);
      if (tokens.length > 0 )
      {
        console.log(tokens)
        var str=''
        for (var i=0 ; i<tokens.length ; i++)
        {
          str+="%"+tokens[i]+"%"
        }
        console.log(str)
        query='select a.card_id,b. isbn,a.fname,a.lname from borrower a,book_loans b where a.card_id=b.card_id and concat(a.fname,a.lname) like ? and b.date_in is null'
        con.query(query,[str],function(err,rows){    
        console.log(query,[str])
        res.render('checkin', { title: 'Library application', message: rows})
        })
      }
    }
  }
  else if(submit_flag == 1)
  {
    console.log(req.query.mykey)
    if (req.query.mykey != undefined)
    {
      var myisbn=(req.query.mykey).substr(0,13)
      var mycardid=(req.query.mykey).substr(13,6)
      query1='update book_loans set date_in=date(now()) where isbn=? and card_id=?'
      con.query(query1,[myisbn,mycardid],function(err,rows){
        if(err)
          throw err;
        else
        {
          console.log(query1,mycardid) 
          query2='update borrower set num_books_issued=num_books_issued-1 where card_id=?'
          con.query(query2,[mycardid],function(err,rows){
            if(err)
              throw err;
            else
            {
              console.log(query2,[mycardid]) 
              query3='update book set available=available+1 where isbn=?'
              con.query(query3,[myisbn],function(err,rows){
                if(err)
                  throw err;
                else
                {
                  console.log(query3,[myisbn]) 
                  txn_message="SUCCESSFUL checkin!"
                  res.render('checkin', { title: 'Library application', txn_msg:txn_message})
                }
              })
            }
          })
        }
      })
    }
    else
    {
      txn_message="Nothing was selected"
      console.log("Nothing was selected") 
      res.render('checkin', { title: 'Library application', txn_msg:txn_message, message: []})
    }
  }
  else
  {
    res.render('checkin', { title: 'Library application'})
  }  
});  

router.get("/user",function(req,res){
  if(req.query.submit_flag == '1')
  {
    var count
    var myssn=req.query.myssn
    var myfname=req.query.myfname
    var mylname=req.query.mylname
    var myaddress=req.query.myaddress
    var mycity=req.query.mycity
    var mystate=req.query.mystate
    var myphone=req.query.myphone
    query1='select count(*) as count from borrower where ssn=?'
    con.query(query1,[myssn],function(err,rows)
    {
      if (rows[0].count != 0)
      {
        txn_message="User already exists!!"
        console.log(txn_message)
        res.render('user', { title: 'Library application', txn_msg: txn_message})
      }
      else
      {
        query2="insert into borrower select lpad((max(card_id)+1),length(card_id),'0') as card_id,?,?,?,?,?,?,?,0 from borrower"
        con.query(query2,[myssn,myfname,mylname,myaddress,mycity,mystate,myphone],function(err,rows){    
          if(err)
          {
            txn_message="Creation failed"
            console.log(txn_message)
            res.render('user', { title: 'Library application', txn_msg: txn_message})
          }
          else
          {
            query3='select max(card_id) as card_id from borrower'
            con.query(query3,function(err,rows){
              txn_message="SUCCESSFUL!! card ID: "+ rows[0].card_id
              console.log(txn_message)
              // console.log(rows.insertId)
              res.render('user', { title: 'Library application', txn_msg: txn_message})
            })
          }
        })
      }
    })
  }
  else
  {
    res.render('user', { title: 'Library application'})
  }
});  

router.get("/fine",function(req,res){
  if(req.query.refresh_flag == undefined && req.query.submit_flag == undefined)
  {
    var query1="select t1.card_id,cast(sum as char) sum,cast(ifnull(to_pay,0.00) as char) to_pay from (select b.card_id as card_id,sum(f.fine_amt) as sum from book_loans b,fines f where b.loan_id=f.loan_id and f.paid=0 group by b.card_id) as t1 left join (select b.card_id as card_id,sum(f.fine_amt) as to_pay from book_loans b,fines f where b.loan_id=f.loan_id and  f.paid=0 and b.date_in is not null group by b.card_id) as t2 on t1.card_id=t2.card_id"
    con.query(query1,function(err,rows){
      // console.log(rows[0])
      res.render('fine', { title: 'Library application', message: rows})
    })
  }
  else if (req.query.refresh_flag == '1' && req.query.submit_flag == undefined)
  {
    var query1="update fines f,book_loans b set f.fine_amt = datediff(ifnull(b.date_in, date(now())) , b.due_date) * 0.25 where f.loan_id = b.loan_id and f.paid = 0"
    con.query(query1,function(err,rows){
      if(err)
      {
        txn_message="Update failed"
        res.render('fine', { title: 'Library application', txn_msg: txn_message})
      }
      else
      {
        var query2="insert into fines select b.loan_id,datediff(ifnull(b.date_in, date(now())),b.due_date) * 0.25,0 from book_loans b where b.due_date < date(now()) and b.loan_id not in(select loan_id from fines)"
        con.query(query2,function(err,rows){
          if(err)
          {
            txn_message="Insert failed"
            res.render('fine', { title: 'Library application', txn_msg: txn_message})
          }
          else
          {
            var query3="select t1.card_id,cast(sum as char) sum,cast(ifnull(to_pay,0.00) as char) to_pay from (select b.card_id as card_id,sum(f.fine_amt) as sum from book_loans b,fines f where b.loan_id=f.loan_id and f.paid=0 group by b.card_id) as t1 left join (select b.card_id as card_id,sum(f.fine_amt) as to_pay from book_loans b,fines f where b.loan_id=f.loan_id and  f.paid=0 and b.date_in is not null group by b.card_id) as t2 on t1.card_id=t2.card_id"
            con.query(query3,function(err,rows){
              txn_message="Refreshed!"
              res.render('fine', { title: 'Library application', message: rows, txn_msg: txn_message})
            })
          }
        })
      }
    })
  }
  else if (req.query.submit_flag == '1' && req.query.radio_flag == '1')
  {
    var mycardid=req.query.mycardid
    var query="update fines f,book_loans b set f.paid=1,fine_amt=0 where f.loan_id = b.loan_id and b.card_id=? and b.date_in is not null"
    con.query(query,[mycardid],function(err,rows)
    {
      if (err)
      {
        txn_message="refresh error"
        console.log(txn_message)
        res.render('fine', { title: 'Library application', txn_msg: txn_message})
      }
      else
      {
        txn_message="Fine paid for "+mycardid
        var query1="update fines f,book_loans b set f.fine_amt = datediff(ifnull(b.date_in, date(now())) , b.due_date) * 0.25 where f.loan_id = b.loan_id and f.paid = 0"
        con.query(query1,function(err,rows)
        {
          if(err)
          {
            txn_message="Update failed"
            res.render('fine', { title: 'Library application', txn_msg: txn_message})
          }
          else
          {
            var query2="insert into fines select b.loan_id,datediff(ifnull(b.date_in, date(now())),b.due_date) * 0.25,0 from book_loans b where b.due_date < date(now()) and b.loan_id not in(select loan_id from fines)"
            con.query(query2,function(err,rows)
            {
              if(err)
              {
                txn_message="Insert failed"
                res.render('fine', { title: 'Library application', txn_msg: txn_message})
              }
              else
              {
                var query3="select t1.card_id,cast(sum as char) sum,cast(ifnull(to_pay,0.00) as char) to_pay from (select b.card_id as card_id,sum(f.fine_amt) as sum from book_loans b,fines f where b.loan_id=f.loan_id and f.paid=0 group by b.card_id) as t1 left join (select b.card_id as card_id,sum(f.fine_amt) as to_pay from book_loans b,fines f where b.loan_id=f.loan_id and  f.paid=0 and b.date_in is not null group by b.card_id) as t2 on t1.card_id=t2.card_id"
                con.query(query3,function(err,rows)
                {
                  txn_message+="and refreshed!"
                  res.render('fine', { title: 'Library application', message: rows, txn_msg: txn_message})
                })
              }
            })
          }
        })
      }
    })
  }
  else
  {
    txn_message="Nothing was selected"
    res.render('fine', { title: 'Library application', txn_msg: txn_message})
  }
});  

app.use("/",router);


app.use("*",function(req,res){
  res.sendFile(path + "404.html");
});

app.listen(3000,function(){
  console.log("Live at Port 3000");
});
