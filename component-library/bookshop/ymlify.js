import yaml from "js-yaml";

export default function () {
	this.registerFilter("ymlify", (yml) => yaml.load(yml));
}
