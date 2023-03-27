{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
	buildInputs = with pkgs; [
		nodejs
	];

	shellHook = ''
		PATH="$PWD/node_modules/.bin:$PATH"
		npm i
	'';
}
