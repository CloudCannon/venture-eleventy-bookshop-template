const { Tokenizer, assert } = require('liquidjs');

module.exports = liquidEngine => {
    return {
      parse: function (token) {
          const tokenizer = new Tokenizer(token.args, this.liquid.options.operatorsTrie);
          this.key = tokenizer.readIdentifier().content;
          tokenizer.skipBlank();
          assert(tokenizer.peek() === '=', () => `illegal token ${token.getText()}`);
          tokenizer.advance();
          this.value = tokenizer.remaining();
      },
      render: function(ctx) {
          ctx.scopes[ctx.scopes.length-1][this.key] = this.liquid.evalValueSync(this.value, ctx);
      }
    }
}