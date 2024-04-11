require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dns = require('dns');

// Basic Configuration
const port = process.env.PORT || 3000;

const Schema = mongoose.Schema;

mongoose.connect(
  process.env.MONGO_URI,
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const shortUrlSchema = new Schema({
  originalUrl: { type: String, required: true },
  shortUrl: { type: String, required: true }
});

shortUrlSchema.pre('save', function() {
  // In 'save' middleware, `this` is the document being saved.
  console.log('Save', (typeof this.originalUrl));
});

const OriginalAndShortUrl = mongoose.model(
  'OriginalAndShortUrl',
  shortUrlSchema
);

async function cleanUpDatabase() {
  await OriginalAndShortUrl.deleteMany();
  const existingData = await OriginalAndShortUrl.find();
  console.log('data:', existingData);
}

// cleanUpDatabase();

const generateRandomString = length => {
  let output = [];

  const getRandomCharacter = () => {
    const characterArray = [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9'
    ];

    let index = Math.floor(Math.random() * characterArray.length);

    return characterArray[index];
  };

  for (i = 0; i < length; i++) {
    output.push(getRandomCharacter());
  }

  return output.join('');
};

const checkUrl = urlString => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false
  }
};

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

let website_url;
let short_url;
let isValidUrl = false;
let alreadyShortenedUrl = false;

app.get(
  '/api/shorturl/:short_url',
  (req, res, next) => {
    let shortUrlInput = req.params.short_url;

    // search from database
    let urlOutput;
    OriginalAndShortUrl.findOne(
      { shortUrl: shortUrlInput },
      (err, urlMatch) => {
        if (err) {
          return console.error(err);
        }
        if (urlMatch) {
          website_url = urlMatch.originalUrl;
          console.log('Found shortUrl:', website_url);
          next();
        }
      }
    );
  },
  (req, res) => {
    console.log('redirect', website_url);
    res.redirect(301, website_url);
  }
);

app
  .route('/')
  .get((req, res) => res.sendFile(process.cwd() + '/views/index.html'));

app.get('/api/shorturl',
  (req, res) => {
    isValidUrl ?
      res.json({
        website_url,
        short_url
      })
      : res.json({ error: 'invalid url' });
  });

app.post(
  '/api/shorturl',
  async (req, res, next) => {
    //check validity url
    isValidUrl = checkUrl(req.body.url);

    if (isValidUrl) {
      const inputUrl = new URL(req.body.url);

      try {
        await new Promise((resolve, reject) => {
          dns.lookup(inputUrl.host, (err, address, family) => {
            isValidUrl = true;
            website_url = inputUrl.toString();
            console.log('dns suc6', website_url);
            resolve();
          });
        })
      } catch (err) {
        console.log('dns fail', err);
        isValidUrl = false;
        reject(err);
      }
    };

    next();
  },

  (req, res, next) => {
  	//check database
  	if (isValidUrl) {
  		OriginalAndShortUrl.findOne(
  			{ originalUrl: website_url },
  			(err, urlMatch) => {
  				if (err) {
  					console.error(err);
  				} else if (urlMatch) {
  					alreadyShortenedUrl = true;
  					short_url = urlMatch.shortUrl;
  					console.log('Already saved');
  					next();
  				}
  			}
  		);
  	}
  },
  (req, res, next) => {
    // store in database
    if (isValidUrl && !alreadyShortenedUrl) {
      short_url = generateRandomString(4);
      let newDatabaseInput = new OriginalAndShortUrl({
        originalUrl: website_url,
        shortUrl: short_url
      });
      console.log(newDatabaseInput);
      newDatabaseInput.save((err, data) => {
        if (err) return console.error(err);
      });
    }
    next();
  },
  (req, res) => {
    console.table([isValidUrl, website_url, short_url]);;
    res.redirect('/api/shorturl');
  }
);

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

