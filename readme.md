#  Game of Thrones Character Map: Friend or Foe?

Alliances, schemes and murder: Interactive chart mapping the chaotic relationships between 116 men, women, wolves and dragons in Game of Thrones. Hover over the characters to learn more about a character and see all current relations. Use the episode slider to go back and forth in time.

A project by [Matthias Huber](https://twitter.com/djmacbest) and [Steffen Kühne](https://twitter.com/stekhn)

![Preview](https://raw.githubusercontent.com/stekhn/got-relationships/master/app/img/preview.jpg)

**Article (English):** http://www.sueddeutsche.de/1.2521382  
**Article (German):** http://www.sueddeutsche.de/1.2477892  
**Demo:** http://gfx.sueddeutsche.de/kultur/gameofthrones/

### Usage
1. Clone the repository
2. Run `npm install`
3. Develop
4. Build a optimized version by running `grunt dist`

### To do
- Update nodes instead of deleting them (feature/data-mangling)
- Implement translation for zoom buttons (feature/zooming)  
- Split main.js in components (graph, navigation etc.)
- Remove external libraries from version control (use Bower)
- Fix loading screen in iOS
- Add house's crests to the sidebar
- Add more languages

### Updating data
The data is stored in [Google Spreadsheet][https://docs.google.com/spreadsheets/d/1SbMWBGGvdh3iKwWIMRL7lHZzKjWfB8oCqMNwKcq8tIY/pubhtml]. The converter fetches and transforms this data. The data can then be copied or downloaded and added to the application.


### Data model

Relations (links):
```javascript
{
  "source": "Eddard Stark",
  "type": "was killed by",
  "target": "Ilyn Payne",
  "start": "s01e09",
  "end": null
}
```

Characters (nodes):
```json
{
  "name": "Eddard Stark",
  "first": "s01e01",
  "killed": "s01e09",
  "faction": "House Stark",
  "crest": "crest_stark.jpg"
}
```

Translation (i18n):
```json
{
  "i18n": "is parent of",
  "en": "is parent of",
  "de": "ist Elternteil von"
}
```
Later the relations get resolved to:
```json
{
  "_id": 1431,
  "source": {
    "name": "Eddard Stark",
    "person": {
      "_id": 1274,
      "name": "Eddard Stark",
      "first": "s01e01",
      "killed": "s01e09",
      "faction": "House Stark",
      "crest": "crest_stark.jpg"
    },
    "index": 7,
    "weight": 20,
    "x": 720.7171306725897,
    "y": 531.0905106520494,
    "px": 720.6759168283094,
    "py": 531.049633077604
  },
  "type": "was killed by",
  "target": {
    "name": "Ilyn Payne",
    "person": {
      "_id": 1365,
      "name": "Ilyn Payne",
      "first": "s01e02",
      "killed": null,
      "faction": "Others",
      "crest": "crest_lannister.jpg"
    },
    "index": 9,
    "weight": 4,
    "x": 602.3886669397419,
    "y": 631.4458306938402,
    "px": 602.5474901577804,
    "py": 631.2127288008816
  },
  "start": "s01e09",
  "end": null,
  "linknum": 1
}
```
