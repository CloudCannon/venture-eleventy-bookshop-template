const fs = require("fs");
const yaml = require("js-yaml");

const generatedWith = "Generated with fetch-theme-variables.js";
const themeDataPath = "src/_data/theme.yml";
const colorGroupsDataPath = "src/_data/color_groups.yml";
const colorGroupsStylePath = "src/assets/styles/color_groups.scss";
const variableStylePath = "src/assets/styles/variables.scss";

// read theme colors and fonts
console.log(`[fetch-theme-variables] Reading ${themeDataPath}`);
const theme = yaml.load(fs.readFileSync(themeDataPath, "utf-8"));

/*
    color_groups get processed differently than other user variables - so
    extract the color_groups and then delete them from the theme object so
    they don't get twice processed when we iterate through the theme object
*/
const customColorGroups = theme.custom_color_groups;
const primaryColorGroup = theme.primary_color_group;
delete theme.custom_color_groups;
delete theme.primary_color_group;

/*
    We have to do a few things to make the user colors usable and show up in the
    CloudCannon config.

    - We need to define all the variables in the :root element of the CSS (cssStringRoot)
    - We need to assign background, text and interaction colors to components (cssStringComponent)
    - We need to assign the background, text and interaction colors to the nav (cssStringNav)
    - We need to assign the background, text and interaction colors to the footer (cssStringFooter)
*/
let cssStringRoot = `:root {\n`;
let cssStringComponent = `.component {\n`;
let cssStringNav = `.c-navigation {\n`;
let cssStringFooter = `.c-footer {\n`;

cssStringComponent += `\t--main-background-color: #3B3B3D;\n`;
cssStringComponent += `\t--main-text-color: #F9F9FB;\n`;
cssStringComponent += `\t--interaction-color: #2566f2;\n`;
cssStringComponent += `\tbackground-color: var(--main-background-color);\n`;
cssStringComponent += `\tcolor: var(--main-text-color);\n\n`;

cssStringNav += `\t--main-background-color: #1B1B1D;\n`;
cssStringNav += `\t--main-text-color: #D9D9DC;\n`;

cssStringFooter += `\t--main-background-color: #1B1B1D;\n`;
cssStringFooter += `\t--main-text-color: #D9D9DC;\n`;

/*
    Function to build the CSS rules:
    - str - the css_string to append values to
    - id - the id value of the color_group
*/
function addColorDefinitions(str, id) {
	str += `&--${id} {\n`;
	str += `\t--main-background-color: var(--${id}__background);\n`;
	str += `\t--main-text-color: var(--${id}__foreground);\n`;
	str += `\t--interaction-color: var(--${id}__interaction);\n`;
	str += `}\n`;
	return str;
}

// these are hardcoded default themes so the user always has at least these color_groups
cssStringComponent += `&--primary {`;
cssStringComponent += `\t--main-background-color : ${primaryColorGroup.background_color};\n`;
cssStringComponent += `\t--main-text-color : ${primaryColorGroup.foreground_color};\n`;
cssStringComponent += `\t--interaction-color : ${primaryColorGroup.interaction_color};\n`;
cssStringComponent += `}\n`;

cssStringNav = addColorDefinitions(cssStringNav, "primary");
cssStringFooter = addColorDefinitions(cssStringFooter, "primary");

const colorGroupsData = [
	{
		id: "primary",
		name: primaryColorGroup.name,
	},
];

/*
    iterate through all the user defined color_groups and:
    - create CSS variables for them
    - add them into the cloudcannon config as options for the dropdowns
*/
customColorGroups.forEach((group, i) => {
	/*
        generate an id for the user defined color_group to be used in CSS class and variable names
        - replace illegal characters
        - append index to end for auto-increment unique ids
    */
	const id = `${group.name.toLowerCase().replace(/[\s|&;$%@'"<>()+,]/g, "_")}${i}`;
	const name = group.name;
	const background = group.background_color;
	const foreground = group.foreground_color;
	const interaction = group.interaction_color;

	colorGroupsData.push({ id, name });

	cssStringRoot += `\t--${id}__background : ${background};\n`;
	cssStringRoot += `\t--${id}__foreground : ${foreground};\n`;
	cssStringRoot += `\t--${id}__interaction : ${interaction};\n`;

	cssStringComponent = addColorDefinitions(cssStringComponent, id);
	cssStringNav = addColorDefinitions(cssStringNav, id);
	cssStringFooter = addColorDefinitions(cssStringFooter, id);
});

cssStringRoot += `}\n\n`;
cssStringComponent += `}\n\n`;
cssStringNav += `}\n\n`;
cssStringFooter += `}\n\n`;

// write the new values to the color groups data file
console.log(`[fetch-theme-variables] Writing ${colorGroupsDataPath}`);
fs.writeFileSync(colorGroupsDataPath, `# ${generatedWith}\n\n` + yaml.dump(colorGroupsData));

// write the css strings into a single file
console.log(`[fetch-theme-variables] Writing ${colorGroupsStylePath}`);
fs.writeFileSync(
	colorGroupsStylePath,
	`/* ${generatedWith} */\n\n` +
		cssStringRoot +
		cssStringComponent +
		cssStringNav +
		cssStringFooter,
);

// Process all other user defined variables, such as fonts
console.log(`[fetch-theme-variables] Reading ${variableStylePath}`);
fs.readFile(variableStylePath, "utf-8", (err, cssFile) => {
	if (err) {
		console.error(err);
		return;
	}

	let replaced = cssFile;

	// Change the variables to whatever was set in the data file
	Object.entries(theme).forEach(([k, v]) => {
		k = k.split("_").join("-");
		const re = new RegExp(`\t--${k}: .*`, "g");
		replaced = replaced.replace(re, `\t--${k}: ${v};`);
	});

	// Write result back
	console.log(`[fetch-theme-variables] Writing ${variableStylePath}`);
	fs.writeFile(variableStylePath, replaced, "utf-8", (err) => {
		if (err) {
			console.error(err);
		}
	});
});
