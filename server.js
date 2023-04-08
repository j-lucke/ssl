const dotenv = require('dotenv')
const express= require('express')
const path = require('path')
const session = require('express-session')

if (process.argv[2] == 'x')
  dotenv.config();

const knex = require('knex')({
    client: 'pg',
    connection: process.env.DB_LOGIN 
});

const app = express()

display = function( data ) {
    console.log(data)
    return data
}

isLoggedIn = function(req, res, next) {
    if (!req.session.username) {
        res.redirect('/')
    } else {
        next()
    }
}

app.set('view engine', 'ejs');

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))

app.use( express.urlencoded({ extended: false }))

app.use(express.static(path.join(__dirname, 'static')))

app.use((req, res, next) => {
    console.log(`request: ${req.url}`)
    next()
})

app.get('/', (req, res, next) => {
    req.session.error = null
    res.render('index.ejs', {session: req.session})
})

app.get('/register', (req, res, next) => {
    res.render('register.ejs', {session: req.session})
})


app.get('/login', (req, res, next) => {
    res.render('login.ejs', {session: req.session})
})

app.get('/logout', (req, res, next) => {
    req.session.username = null
    req.session.password = null
    req.session.error = null
    res.redirect('/')
})

app.get('/users/:username', isLoggedIn, async function(req, res, next){
    logs = await knex.select('logs').from('users').where({username: req.session.username})
        .then( (records) => {
            if (records[0].logs) 
                return records[0].logs.split(' ')
            else
                return []
        }).then()

    res.render('user.ejs', {session:  req.session, logs: logs})
})

app.get('/users/:username/:log', isLoggedIn, (req, res, next) => {
    const tableName = req.params.username + '_' + req.params.log
    knex.select('*').from(tableName).orderBy('post_id').then((data) => {
        res.render('log.ejs', {session: req.session, log: req.params.log, data: data})
    })
    
})

app.get('/newlog', (req, res, next) => {
    res.render('newlog.ejs', {session: req.session})
})

app.get('/newentry/:username/:log', (req, res, next) => {
    res.render('newentry.ejs', {session: req.session, log:req.params.log})
})

app.get('/edit/:username/:log/:post_id', (req, res, next) => {
    const tableName = req.params.username + '_' + req.params.log
    knex.select('*').from(tableName).where({post_id: req.params.post_id})
        .then((data) => {
            res.render('edit.ejs', {session: req.session, log: req.params.log, data: data[0]})
        })
    
})

app.post('/edit/:username/:log/:post_id', (req, res, next) => {
    const tableName = req.params.username + '_' + req.params.log
    knex(tableName).update({name: req.body.name, text: req.body.text}).where({post_id: req.params.post_id})
        .then(res.redirect('/users/' + req.params.username + '/' + req.params.log))
})

app.post('/newentry/:username/:log', (req, res, next) => {
    const tableName = req.params.username + '_' + req.params.log
    knex.insert({name: req.body.name, text: req.body.entry}).into(tableName)
        .then(res.redirect('/users/' + req.params.username + '/' + req.params.log))
})

app.post('/login', (req, res, next) => {
    const username = req.body.username
    const password = req.body.password
    knex.select('*').from('users').where({username: username, password: password})
        .then(data => {
            if (data.length == 0) {
                console.log('username or password error')
                req.session.error = 'username or password error'
                res.redirect('/login')
            } else {
                req.session.username = username
                res.redirect('/users/'+ username)
            }
        })
})

app.post('/register', (req, res, next) => {
    const username = req.body.username
    const password = req.body.password
    const confirmPassword = req.body.confirm_password
    knex.select('*').from('users').where({username: username})
        .then(display)
        .then( users => {
            if (users.length != 0) {
                req.session.error = 'username unavailable'
                res.redirect('/register')
            } else{
                if (password != confirmPassword) {
                    req.session.error = 'passwords do not match'
                    console.log('yup')
                    res.redirect('/register')
                } else {
                    req.session.username = username
                    knex.insert({username: username, password: password}).into('users')
                        .then(() => {
                            console.log(`created new user ${username}`)
                        })
                    res.redirect('/users/' + username)
                }
            }
        })
})

app.post('/newlog', isLoggedIn, async (req, res, next) => {
    const logName = req.body.log_name.split(' ')[0]
    const data = await knex.select('logs').from('users').where({username: req.session.username}).then()
    let logs
    if (data[0].logs)
        logs = data[0].logs.split(' ')
    else
        logs = []
    const index = logs.indexOf(logName)
    if (index == -1) {
        logs.push(logName)
        const logStr = logs.join(' ')
        
        const tableName = req.session.username + '_' + logName
        await knex.schema.createTable(tableName, function (table) {
            table.increments('post_id')
            table.string('name')
            table.text('text')
            table.timestamps(true, true)
        })

        await knex('users').where({username: req.session.username})
            .update({logs: logStr})
            .then(res.redirect(`/users/${req.session.username}`))
    } else {
        req.session.error = 'you already have a log by that name!'
        res.redirect('/newlog')
    }
})

app.listen(3000, () => {
    console.log('listening on 3000 . . .')
})