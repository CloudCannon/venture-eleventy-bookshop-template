import yaml from "js-yaml";

module.exports = function (Liquid) {
    this.registerFilter("ymlify", (yml) => {
        return yaml.load(yml)
    });
}