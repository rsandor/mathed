var mathed = require('./index.js')
    parser = mathed.all();


console.log(mathed.parse('sum{i=1}{10} i^2'));
