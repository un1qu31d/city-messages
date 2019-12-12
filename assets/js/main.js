/*********************/
/*        SYS        */
/*********************/
var sys = {
  loaded: false,
  loadCallBack: () => {},
  map: {
    loaded: false,
    loadCallBack: () => {}
  }
}
/**************************/
/*        MESSAGES        */
/**************************/
class Messages {
  categories = [];
  messages = [];

  addCategory = category => {
    this.categories.push(category);
  };
  
  getCategories = () => this.categories;

  addMessage = message => {
    this.messages.push(message);
  };

  editMessage = (index, message) => {
    this.messages[index] = message;
  };

  getMessages = () => this.messages;
}
/*****************************/
/*        GOOGLE MAPS        */
/*****************************/
class GoogleMap {
  constructor(props) {
    this.element = props.element;
  }
  markers = new Map();
  markersPointer = 0;
  
  init = () => {
    this.map = new google.maps.Map(this.element, {
      center: {lat: 0, lng: 0},
      zoom: 2
    });
  };

  addMarker = (marker, message) => {
    this.markers.set(this.markersPointer, {
      message,
      marker: new google.maps.Marker({
        position: {lat: marker.lat, lng: marker.lng},
        icon: (() => {
          switch(marker.category) {
            case 'positive':
              return './files/images/like.png';
            case 'negative':
              return './files/images/sad.png';
            default:
              return './files/images/comment.png';
          }
        })(),
        map: this.map
      })
    });
    this.markersPointer++;
  }

  removeMarker = key => {
    this.markers.get(key).marker.setMap(null);
    this.markers.delete(key);
  }

  getMarkersByMessage = message => [...this.markers].filter(marker => marker[1].message === message).map((marker, markerKey) => marker[1]);

  getMarkers = () => [...this.markers].map((marker, markerKey) => this.markers.get(markerKey));
}
/**********************/
/*        TABS        */
/**********************/
class Tabs {
  constructor(props) {
    this.element = props.element;
    this.tabs = props.tabs;
    this.boxes = props.boxes;
  }

  init = () => {
    this.element.querySelector('.tabs__labels').innerHTML = this.tabs.map(tab => `
      <div data-id="${tab.label}" class="tabs__label">
        ${tab.label}
      </div>
    `).join('');
    this.element.querySelector('.tabs__boxes').innerHTML = this.boxes.map((box, boxIndex) => `
      <div data-id="${boxIndex}" data-category="${box.category}" class="tabs__box">
        <div class="tabs__box__image">
        <img src="${(() => {
          switch(box.category.toLowerCase()) {
            case 'positive':
              return './files/images/like.png';
            case 'negative':
              return './files/images/sad.png';
            default:
              return './files/images/comment.png';
          }
        })()}">
        </div>
        <div class="tabs__box__content">
          ${box.content}
        </div>
      </div>
    `).join('');
    this.element.addEventListener('click', event => {
      if(event.target.matches('.tabs__label')) {
        const category = event.target.getAttribute('data-id');
        [...this.element.querySelectorAll('.tabs__label')].forEach(label => {
          label.classList.remove('status--active');
        });
        event.target.classList.add('status--active');
        this.tabs.find(tab => tab.id === category).callBack(category);
        [...this.element.querySelectorAll('.tabs__box')].forEach(label => {
          label.classList.remove('status--active');
        });
        this.element.querySelectorAll(`.tabs__box[data-category="${category}"]`).forEach(box => {box.classList.add('status--active')});
        if(category === 'all') {
          this.element.querySelectorAll(`.tabs__box[data-category]`).forEach(box => {box.classList.add('status--active')});
        }
      }
      if(event.target.closest('.tabs__box')) {
        const message = parseInt(event.target.closest('.tabs__box').getAttribute('data-id'));
        this.boxes.find((box, boxIndex) => boxIndex === message).callBack(message);
      }
    });
    this.element.querySelector('.tabs__label:nth-child(1)').click();
  }
}
/*************************/
/*        GENERAL        */
/*************************/
(async () => {
  // INIT MESSAGES
  const messages = new Messages();
  const data = await fetch('https://spreadsheets.google.com/feeds/list/0Ai2EnLApq68edEVRNU0xdW9QX1BqQXhHRl9sWDNfQXc/od6/public/basic?alt=json')
  .then(response => response.json())
  .then(data => data);
  data.feed.entry.forEach(record => {
    function messageToObj(string, fields = {}) {
      const slicePointer = string.slice(0, string.lastIndexOf(":")).lastIndexOf(",");
      const [key, value] = string.slice(slicePointer + 1).split(':').map(value => value.trim());
      fields[key] = value;
      return slicePointer === -1 ? fields : messageToObj(string.slice(0, slicePointer), fields);
    }
    const [date, time] = record.title.$t.split(' ');
    const {messageid, message, sentiment} = messageToObj(record.content.$t);
    messages.addMessage({
      messageid,
      message,
      sentiment,
      date,
      time
    });
  });
  messages.getMessages().reduce((categories, message) => {
    if(!categories.filter(category => category === message.sentiment).length) categories.push(message.sentiment);
    return categories;
  }, []).forEach(category => {
    messages.addCategory(category);
  });
  // INIT GOOGLE MAPS
  const googleMap = new GoogleMap({
    element: document.getElementById('map')
  });
  await new Promise(resolve => {
    setInterval(() => {
      if(sys.map.loaded) resolve();
    }, 100);
  });
  googleMap.init();
  // INIT TABS
  const tabs = new Tabs({
    element: document.getElementById('messages'),
    tabs: [
      {id: 'all', label: 'all', callBack: () => {}},
      ...messages.getCategories().map(category => ({id: category, label: category, callBack: () => {}}))
    ],
    boxes: messages.getMessages().map(message => ({content: message.message, category: message.sentiment, callBack: () => {}}))
  });
  tabs.init();
  // LOADED
  const initSys = () => {
    document.querySelector('.component--loader').classList.remove('status--active');
  };
  if(sys.loaded) {
    initSys();
  } else {
    sys.loadCallBack = initSys;
  }
  // DRAW ON MAP
  document.querySelector('.city-messages__view').classList.add('status--loading');
  await Promise.all(messages.getMessages().map((message, messageIndex) => fetch(`http://un1qu31d.000webhostapp.com/api/city%20messages/?q=${message.message}`)
  .then(response => response.json())
  .then(cities => ({key: messageIndex, marker: {...message, cities}}))))
  .then((values) => {
    values.forEach(value => {
      messages.editMessage(value.key, value.marker);
    });
    document.querySelector('.city-messages__view').classList.remove('status--loading');
  });
  // TABS CALLBACK
  function drawCityMessagesOnMap(cityMessages) {
    googleMap.markers.forEach((marker, markerKey) => {
      googleMap.removeMarker(markerKey);
    });
    cityMessages.forEach((message, messageIndex) => {
      message.cities.forEach(city => {
        googleMap.addMarker({lat: parseInt(city.lat), lng: parseInt(city.lng), category: message.sentiment.toLowerCase()}, messageIndex);
      });
    });
  }
  tabs.tabs.find(tab => tab.id === 'all').callBack = (id) => {drawCityMessagesOnMap(messages.getMessages())};
  tabs.tabs.filter(tab => tab.id !== 'all').forEach(tab => {
    tab.callBack = (id) => {drawCityMessagesOnMap(messages.getMessages().filter(message => message.sentiment === id))}
  });
  tabs.element.querySelector('.tabs__label.status--active').click();
  tabs.boxes.forEach(box => {
    box.callBack = (message) => {
      // googleMap.getMarkers().forEach(marker => {
      //   marker.marker.setAnimation(null);
      // });
      // googleMap.getMarkersByMessage(message).forEach(marker => {
      //   marker.marker.setAnimation(google.maps.Animation.BOUNCE);
      // });
    }
  });
})();

window.onload = () => {
  sys.loaded = true;
  sys.loadCallBack();
};

function initMap() {
  sys.map.loaded = true;
  sys.map.loadCallBack();
}