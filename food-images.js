/**
 * Free Unsplash images matched to dish names / categories.
 */
(function (global) {
  var U = function (id, w) {
    w = w || 600;
    return 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + w + '&h=400&q=80';
  };

  var DISH = {
    'margherita': U('photo-1574071318508-1cdbab80d002'),
    'pepperoni': U('photo-1628840042765-356cda07504e'),
    'truffle': U('photo-1593560708920-61dd98c46a4e'),
    'funghi': U('photo-1593560708920-61dd98c46a4e'),
    'maltese special': U('photo-1565299624946-b28f40a0ae38'),
    'garlic bread': U('photo-1573140401552-3fab57d237bf'),
    "chef's burger": U('photo-1568901346375-23c9450c58cd'),
    'chicken burger': U('photo-1606755962773-d324e0a13086'),
    'veggie burger': U('photo-1520072959219-c595dc870360'),
    'loaded fries': U('photo-1573080496219-bb080dd4f877'),
    'onion rings': U('photo-1639024471283-03530db63f13'),
    'milkshake': U('photo-1572490122747-3968b75cc699'),
    'pastizzi': U('photo-1509440159596-0249088772ff'),
    'rabbit': U('photo-1547592166-23ac45744acd'),
    'stew': U('photo-1547592166-23ac45744acd'),
    'lampuki': U('photo-1467003909585-2f8a72700288'),
    'pie': U('photo-1467003909585-2f8a72700288'),
    'ftira': U('photo-1509440159596-0249088772ff'),
    'imqaret': U('photo-1488477181946-6428a0291777'),
    'salmon nigiri': U('photo-1583623025817-d180a2225852'),
    'nigiri': U('photo-1583623025817-d180a2225852'),
    'california': U('photo-1579871494447-9811cf80d66c'),
    'spicy tuna': U('photo-1617196034796-73dfa7b1fd56'),
    'dragon roll': U('photo-1611143669185-af224c5e3252'),
    'miso': U('photo-1606491956689-2ea866880c84'),
    'green tea': U('photo-1564890369478-c89ca6d9cde9'),
    'power bowl': U('photo-1546069901-ba9599a7e63c'),
    'salmon bowl': U('photo-1512621776951-a57141f2eefd'),
    'falafel': U('photo-1601050690597-df0568f70950'),
    'acai': U('photo-1590301157890-4810ed352733'),
    'smoothie': U('photo-1610970881699-44a5587cabec'),
    'protein shake': U('photo-1622597467836-f3285f2131b8'),
    'lava cake': U('photo-1624353365286-3f8d62daad51'),
    'chocolate': U('photo-1624353365286-3f8d62daad51'),
    'tiramisu': U('photo-1571877227200-a0d98ea607e9'),
    'gelato': U('photo-1563805042-7684c019e1cb'),
    'cheesecake': U('photo-1533134242443-d4fd215305ad'),
    'brownie': U('photo-1606313564200-e75d5e30476c'),
    'espresso': U('photo-1510591509098-f4fdc6d0ff04'),
    'cola': U('photo-1622483767028-3f66f32aef97'),
    'kinnie': U('photo-1622483767028-3f66f32aef97')
  };

  var CATEGORY = {
    'Pizza': U('photo-1513104890138-7c749659a591'),
    'Burgers': U('photo-1568901346375-23c9450c58cd'),
    'Maltese food': U('photo-1504674900247-0877df9cc836'),
    'Maltese': U('photo-1504674900247-0877df9cc836'),
    'Sushi': U('photo-1579871494447-9811cf80d66c'),
    'Healthy bowls': U('photo-1512621776951-a57141f2eefd'),
    'Bowls': U('photo-1512621776951-a57141f2eefd'),
    'Desserts': U('photo-1551024601-bec78aea704b'),
    'Sides': U('photo-1573080496219-bb080dd4f877'),
    'Drinks': U('photo-1544145945-f90425324c8f')
  };

  var DEFAULT = U('photo-1546069901-ba9599a7e63c');

  function resolveFoodImage(name, category, width) {
    var n = String(name || '').toLowerCase();
    var keys = Object.keys(DISH);
    for (var i = 0; i < keys.length; i++) {
      if (n.indexOf(keys[i]) !== -1) {
        return width ? DISH[keys[i]].replace(/w=\d+/, 'w=' + width) : DISH[keys[i]];
      }
    }
    if (category && CATEGORY[category]) {
      return width ? CATEGORY[category].replace(/w=\d+/, 'w=' + width) : CATEGORY[category];
    }
    return width ? DEFAULT.replace(/w=\d+/, 'w=' + width) : DEFAULT;
  }

  global.resolveFoodImage = resolveFoodImage;
  global.FOOD_CATEGORY_IMAGES = CATEGORY;
})(typeof window !== 'undefined' ? window : this);
