/**
 * mathed.js
 * By Ryan Sandor Richards
 */

/**
 * The Mathed Library
 * @author Ryan Sandor Richards
 */
var Mathed = (function() {
  // The list of named plugins
  var plugins = {};

  // Various helper functions to make the code more readable
  function error(msg) {
    throw "Mathed -- " + msg;
  }

  function isset(a) {
    return (typeof(a) != "undefined" && a != null);
  }

  function escapeRegex(s) {
    var search = ['+', '\\', '[', ']', '|', '^', '$', '*', '?', '(', ')', '{', '}', '!'];
    for (var i = 0; i < search.length; i++) {
      var ch = search[i];
      s = s.replace( new RegExp('\\'+ch, 'g'), '\\'+ch);
    }
    return s;
  }

  /**
   * Abstract Syntax Tree Node, for representing the parsed mathed input.
   */
  function Node(type, value) {
    this.type = type;
    this.value = value;
    this.children = [];
  }

  Node.prototype.addChild = function(c) {
    this.children.push(c);
  };

  /**
   * The Mathed Parser class. Instantiations of this class are used
   * to perform the actual parsing of input into symbolic HTML.
   * @param pluginNames (optional) Which plugins to use for parsing.
   * @throws Exception if a specified plugin name isn't a valid plugin.
   */
  function MathedParser(pluginNames) {
    var direct = [],
      special = [],
      map = {tokens: [], mapping: {}};

    // Loads a plugin with the given name
    function load(name) {
      var plugin = plugins[name], i;
      if (!plugin)
        error("Plugin with name '" + name + "' was not found.");

      // Add direct translation items
      if ( isset(plugin.direct) ) {
        for (i = 0; i < plugin.direct.length; i++)
          direct.push(plugin.direct[i]);
      }

      // Add special non-emphasised variable names (usually function names)
      if ( isset(plugin.special) ) {
        for (i = 0; i < plugin.special.length; i++)
          special.push(plugin.special[i]);
      }

      // Add special mappings of names to elements
      if ( isset(plugin.map) ) {
        for (i in plugin.map) {
          map.mapping[i] = plugin.map[i];
          map.tokens.push(escapeRegex(i));
        }
      }
    }

    // Load the required parser plugins
    if (typeof pluginNames == "undefined") {
      for (var k in plugins)
        load(k);
    }
    else {
      for (var i = 0; i < pluginNames.length; i++) {
        load(pluginNames[i]);
      }
    }

    // Compile the token types expressions and master lexer pattern
    this.TokenTypes = {
      map: false,
      direct: false,
      special: false,
      number: /[0-9]+(\.[0-9]+)?/,
      unary: /[_\^]/,
      binary: 'frac|sum|prod',
      name: /[a-zA-Z]/,
      operator: /[+\-*\/=:%!]/,
      pipe: /\|/,
      left_paren: /\(/,
      right_paren: /\)/,
      left_bracket: /\[/,
      right_bracket: /\]/,
      left_brace: /\{|\\\{/,
      right_brace: /\}|\\\}/
    };

    if (map.tokens.length > 0)
      this.TokenTypes.map = new RegExp(map.tokens.join('|'));
    if (direct.length > 0)
      this.TokenTypes.direct = new RegExp(direct.join('|'));
    if (special.length > 0)
      this.TokenTypes.special = new RegExp(special.join('|'));

    // Generate a global pattern token matcher
    var patterns = [];
    for (var k in this.TokenTypes) {
      var type = this.TokenTypes[k];
      if (type !== false) {
        var pattern = type.toString().replace(/^\//,'(').replace(/\/$/,')');
        patterns.push(pattern);
      }
    }
    this.lexExp = new RegExp(patterns.join('|'), 'g');

    // Fix the token types for exact match
    for (var k in this.TokenTypes) {
      var type = this.TokenTypes[k],
        exact = type.toString().replace(/^\//, '^(').replace(/\/$/, ')$');
      this.TokenTypes[k] = exact;
    }

    // Instance variables to aid translation
    this.map = map;
  }

  /**
   * Performs lexical analysis on a given string.
   * @param s String to lex
   * @return A list of tokens with associated types.
   */
  MathedParser.prototype.lex = function(s) {
    if (typeof s == "undefined")
      return [];

    var tokens = [],
      parts = s.match(this.lexExp);

    if (parts == null)
      return [];

    for (var i = 0; i < parts.length; i++)
    for (var t in this.TokenTypes) {
      if (parts[i].match(this.TokenTypes[t])) {
        tokens.push({value: parts[i], type: t});
        break;
      }
    }

    return tokens;
  };

  /**
   * Simple stack-based parser for constructing the AST.
   * @param tokens List of tokens to parse.
   * @return An abstract parse tree for the list of tokens.
   * @throws Parse errors if encountered.
   */
  MathedParser.prototype.parse = function(tokens) {
    if (!tokens || tokens.length < 1)
      return null;

    var root = new Node('root'), stack = [ root ], args = 0;

    function top() {
      return stack[ stack.length - 1 ];
    }

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], child = null;

      switch (t.type) {
        case 'left_paren':
        case 'left_bracket':
        case 'left_brace':
          child = new Node(t.type, t.value);
          top().addChild(child);
          stack.push(child);
          break;
        case 'right_paren':
          if (top().type != 'left_paren')
            error('Unmatched right parenthesis.');
          stack.pop();
          break;
        case 'right_bracket':
          if (top().type != 'left_bracket')
            error('Unmatched right bracket.');
          stack.pop();
          break;
        case 'right_brace':
          if (top().type != 'left_brace')
            error('Unmatched right brace.');
          stack.pop();
          break;
        case 'unary':
          child = new Node(t.type, t.value);
          top().addChild(child);
          stack.push(child);
          child.args = 1;
          break;
        case 'binary':
          child = new Node(t.type, t.value);
          top().addChild(child);
          stack.push(child);
          child.args = 2;
          break;
        default:
          top().addChild( new Node(t.type, t.value) );
          break;
      }

      if (isset(top().args)) {
        top().args--;
        if (top().args < 0)
          stack.pop();
      }
    }

    switch (top().type) {
      case 'unary':
      case 'binary':
        error('Invalid number of arguments for ' + top().type + ' function "' + top().value + '"');
      case 'left_paren':
        error('Unclosed left parenthesis');
      case 'left_bracket':
        error('Unclosed left bracket');
      case 'left_brace':
        error('Unclosed left brace');
    }

    return root;
  };

  /**
   * Translates a parse tree into a string of mathematics HTML.
   * @param root Root node of the tree to translate.
   * @return Translated HTML from the parse tree.
   */
  MathedParser.prototype.translate = function(root) {
    if (!root)
      return '';

    var html = '', map = this.map.mapping;

    // Traverse the tree to determine the size of parentheticals
    function prec(n) {
      var m = 0, pipes = [];

      for (var i = 0; i < n.children.length; i++) {
        m = Math.max(m, prec( n.children[i] ));
        if ( n.children[i].type == 'pipe' )
          pipes.push(n.children[i]);
      }

      for (i = 0; i < pipes.length; i++)
        pipes[i].parenSize = m;
      n.parenSize = m;

      if (
        n.type == 'binary' || n.type == 'left_paren' || n.type == 'left_bracket' ||
        (n.type == 'left_brace' && n.value == '\\{')
      ) {
        m++;
      }

      return m;
    };
    prec(root);

    // Traverses the parse tree to form HTML
    function trec(n) {
      var h1 = '', h2 = '';

      switch (n.type) {
        // Atoms
        case 'special':
        case 'number':    return n.value;
        case 'map':       return map[n.value];
        case 'direct':    return ['&', n.value, ';'].join('');
        case 'name':      return ['<em>', n.value, '</em>'].join('');
        case 'operator':  return ' ' + n.value + ' ';

        case 'pipe':
          if (n.parenSize == 0)
            return ' | ';

          h1 = ' <div class="ou">';
          for (var k = 0; k < n.parenSize; k++)
            h1 += '<div class="p">&#9168;</div>';
          return h1 + '</div> ';

        // Parentheticals
        case 'left_paren':
          for (var k = 0; k < n.children.length; k++)
            h1 += trec( n.children[k] );

          if (n.parenSize > 0) {
            // Left Paren
            h2 = '<div class="ou"><div class="p">&#9115;</div>';
            for (var i = 0; i < n.parenSize - 1; i++)
              h2 += '<div class="p">&#9116;</div>';
            h2 += '<div class="p">&#9117</div></div>';

            // Contents
            h2 += ' ' + h1 + ' ';

            // Right paren
            h2 += '<div class="ou"><div class="p">&#9118;</div>';
            for (var i = 0; i < n.parenSize - 1; i++)
              h2 += '<div class="p">&#9119;</div>';
            h2 += '<div class="p">&#9120</div></div>';

            return h2;
          }
          return ['(', h1, ')'].join('');

        case 'left_bracket':
          for (var k = 0; k < n.children.length; k++)
            h1 += trec( n.children[k] );

          if (n.parenSize > 0) {
            // Left Paren
            h2 = '<div class="ou"><div class="p">&#9121;</div>';
            for (var i = 0; i < n.parenSize - 1; i++)
              h2 += '<div class="p">&#9122;</div>';
            h2 += '<div class="p">&#9123</div></div>';

            // Contents
            h2 += ' ' + h1 + ' ';

            // Right paren
            h2 += '<div class="ou"><div class="p">&#9124;</div>';
            for (var i = 0; i < n.parenSize - 1; i++)
              h2 += '<div class="p">&#9125;</div>';
            h2 += '<div class="p">&#9126</div></div>';

            return h2;
          }
          return ['[', h1, ']'].join('');

        case 'left_brace':
          for (var k = 0; k < n.children.length; k++)
            h1 += trec( n.children[k] );

          if (n.value != '\\{')
            return h1;

          if (n.parenSize == 0) {
            return ['{', h1, '}'].join('');
          }

          if (n.parenSize == 1) {
            return [
              '<div class="ou"><div class="p">&#9136;</div><div class="p">&#9137;</div></div>',
              h1,
              '<div class="ou"><div class="p">&#9137;</div><div class="p">&#9136;</div></div>'
            ].join('');
          }

          var m = ((n.parenSize / 2) | 0) - 1;
          h2 = '<div class="ou"><div class="p">&#9127;</div>';
          for (var i = 0; i < m; i++)
            h2 += '<div class="p">&#9130;</div>';
          h2 += '<div class="p">&#9128;</div>';
          for (var i = 0; i < m; i++)
            h2 += '<div class="p">&#9130;</div>';
          h2 += '<div class="p">&#9129;</div></div>';

          h2 += ' ' + h1 + ' ';

          h2 += '<div class="ou"><div class="p">&#9131;</div>';
          for (var i = 0; i < m; i++)
            h2 += '<div class="p">&#9130;</div>';
          h2 += '<div class="p">&#9132;</div>';
          for (var i = 0; i < m; i++)
            h2 += '<div class="p">&#9130;</div>';
          h2 += '<div class="p">&#9133;</div></div>';

          return h2;


        // Single argument functions
        case 'unary':
          h1 = trec( n.children[0] );
          if (n.value == '^')
            return ['<sup>', h1, '</sup>'].join('');
          else if (n.value == '_')
            return ['<sub>', h1, '</sub>'].join('');

        // Binary functions
        case 'binary':
          h1 = trec( n.children[0] );
          h2 = trec( n.children[1] );

          if (n.value == 'frac')
            return ['<div class="ou"><div>', h1, '</div><hr><div>', h2, '</div></div>'].join('');
          else if (n.value == "sum" || n.value == "prod") {
            return [
              '<div class="ou"><div class="small">',
                h2,
              '</div><div class="m bigger">',
                '&', n.value, ';',
              '</div><div class="small">',
                h1,
              '</div></div>'
            ].join('');
          }
      }
    }

    // Translate to HTML
    for (var i = 0; i < root.children.length; i++)
      html += trec(root.children[i]);

    return html;
  };

  /**
   * Converts an input string into math HTML by lexing, parsing, and then translating.
   * @param s String to convert
   * @return The math HTML conversion of the string
   */
  MathedParser.prototype.convert = function(s) {
    return this.translate( this.parse( this.lex(s) ) );
  };

  // Public interface
  return {
    /**
     * @return A parser with all plugins loaded.
     */
    all: function() {
      return new MathedParser();
    },

    /**
     * Creates and returns mathed parser that uses only the specified plugins.
     * @param n1, n2, ... Names of the plugins to use for the parser instance.
     * @return The parser instance that uses only the specified plugins.
     */
    only: function() {
      return new MathedParser(arguments);
    },

    /**
     * Creates and returns a mathed parser that uses everything but the given
     * plugins.
     * @param n1, n2, ... Names of the plugins to exclude.
     * @return A parser instance that uses everything but the specified plugins.
     */
    not: function() {
      var pluginNames = [];
      for (var k in plugins) {
        var use = true;
        for (var i = 0; i < arguments.length; i++) {
          if (arguments[i] == k) {
            use = false;
            break;
          }
        }
        if (use)
          pluginNames.push(k);
      }
      return new MathedParser(pluginNames);
    },

    /**
     * Adds a plugin to the Mathed system.
     * @param n Name for the plugin
     * @param p Plugin object
     * return The Mathed object.
     */
    plugin: function(n, p) {
      plugins[n] = p;
      return Mathed;
    },

    /**
     * Parses an input string and produced math HTML.
     * @param str.
     */
    parse: function(str) {
      return (new MathedParser()).convert(str);
    }
  };
})();

/*
 * In this section we define built-in plugins for use with the Mathed Library.
 */

// Greek Letters
Mathed.plugin('greek', {
  direct: [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota',
    'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau',
    'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega', 'alpha', 'beta', 'gamma', 'delta',
    'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
    'omicron',  'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'
  ]
});

// Common mathematical functions
Mathed.plugin('functions', {
  special: [
    'sin', 'cos', 'tan', 'cot', 'sec', 'cosec', 'arcsin', 'arccos', 'arctan',
    'arccot', 'sinh', 'cosh', 'tanh', 'coth', 'arsinh', 'arcosh', 'artanh', 'arcoth',
    'mod', 'abs', 'rnd', 'rand', 'min', 'max', 'gcd', 'lcm', 'exp', 'sqrt', 'ln',
    'lg', 'log'
  ]
});

// Comparisons
Mathed.plugin('comparisons', {
  map: {
    '<=': ' &le; ',
    '>=': ' &ge; ',
    '!=': ' &ne; ',
    '<': ' &lt; ',
    '>': ' &gt; '
  }
});

// Mathematical Logic
Mathed.plugin('logic', {
  direct: ['not', 'exist'],
  map: {
    '&&': ' &and; ',
    'and': ' &and; ',
    '||': ' &or; ',
    'or': ' &or; ',
    'to': ' &rarr; ',
    'from': ' &larr; ',
    'iff': ' &harr; ',
    'all': '&#8704;',
    '|-': ' &#8870; ',
    '|=': ' &#8873; '
  }
});

// Sets
Mathed.plugin('set', {
  direct: ['empty'],
  map: {
    'union': ' &#x22c3; ',
    'cup': ' &#x22c3; ',
    'intersect': ' &#x22c2; ',
    'cap': ' &#x22c2; ',
    'in': ' &#8712; ',
    'notin': ' &#8713; '
  }
});

// Blackboard Bold font symbols
Mathed.plugin('blackboard', {
  map: {
    'bbR': '<span class="big">&#8477;</span>',
    'bbC': '<span class="big">&#8450;</span>',
    'bbN': '<span class="big">&#8469;</span>',
    'bbP': '<span class="big">&#8473;</span>',
    'bbQ': '<span class="big">&#8474;</span>',
    'bbZ': '<span class="big">&#8484;</span>'
  }
});

// Misc mathematical symbols
Mathed.plugin('misc', {
  direct: ['infin'],
  map: {
    '+-': ' &plusmn; ',
    "'": ' &prime;',
    ',': ', '
  }
});

if (typeof window !== "undefined") {
  window.Mathed = Mathed;
}

module.exports = Mathed;
