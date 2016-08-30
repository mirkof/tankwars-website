/*global describe, it, jasmine, expect, require, beforeEach */
var TankWarsModel = require('../scripts/tankwars-model');
describe('TankWarsModel', function () {
	'use strict';
	var randomizer, mazeBuilder; /*, changeListener;*/
	beforeEach(function () {
		randomizer = jasmine.createSpyObj('randomizer', ['shuffle', 'random', 'randomInt']);
		mazeBuilder = jasmine.createSpy('mazeBuilder');

		mazeBuilder.and.returnValue([{x: 1, y: 0}, {x: 0, y: 1}]);

		randomizer.shuffle.and.callFake(function (array) {
			return array.slice().reverse();
		});
	});
	it('builds a map when it newMatchs, with tanks and walls', function () {
		var model = new TankWarsModel(),
			result;
		model.newMatch({
			numTanks: 5,
			mapWidth: 50,
			mapHeight: 20
		});
		result = model.getMap();

		expect(result.tanks.length).toEqual(5);
		expect(result.width).toEqual(50);
		expect(result.height).toEqual(20);
	});
	it('puts tanks on random orientation', function () {
		var model, map;
		randomizer.shuffle.and.callFake(function (array) {
			array.push(array.shift());
			return array;
		});
		model = new TankWarsModel({
			randomizer: randomizer,
			mazeBuilder: mazeBuilder
		});
		model.newMatch({
			numTanks: 3,
			mapWidth: 3,
			mapHeight: 2
		});
		map = model.getMap();
		expect(map.tanks[0].direction).toEqual('left');
		expect(map.tanks[1].direction).toEqual('bottom');
		expect(map.tanks[2].direction).toEqual('right');

	});
	it('places tanks into random empty spots on the map', function () {
		var model, map;
		/*  012
		 * 0.x.
		 * 1x..
		 */
		model = new TankWarsModel({
			randomizer: randomizer,
			mazeBuilder: mazeBuilder
		});
		model.newMatch({
			numTanks: 2,
			mapWidth: 3,
			mapHeight: 2
		});
		map = model.getMap();
		expect(map.tanks[0].x).toEqual(1);
		expect(map.tanks[0].y).toEqual(1);

		expect(map.tanks[1].x).toEqual(0);
		expect(map.tanks[1].y).toEqual(0);
	});
	it('dispatches newMatch when a match is initialized', function () {
		var model = new TankWarsModel(),
			listener = jasmine.createSpy();
		model.on('newMatch', listener);
		model.newMatch({
			numTanks: 2,
			mapWidth: 3,
			mapHeight: 2
		});
		expect(listener).toHaveBeenCalledWith(model.getMap());
	});
	describe('tank commands', function () {
		[{name: 'left', x: -1, y: 0}, {name: 'right', x: 1, y: 0}, {name: 'top', x: 0, y: -1}, {name: 'bottom', x: 0, y: 1}].forEach(function (direction) {
			describe('when facing ' + direction.name, function () {
				describe('forward', function () {
					it('moves tank by 1 place if space is available', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 100, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5
						});
						model.executeCommand(0, 'forward');
						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1 + direction.x);
						expect(model.getMap().tanks[0].y).toEqual(2 + direction.y);
						expect(model.getMap().tanks[0].strength).toEqual(100);
						expect(model.getMap().tanks[0].status).toEqual('moving');
					});
					it('resets status for all other tanks', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 100, direction: direction.name}, { x: 4, y: 4, status: 'moving'}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5
						});
						model.executeCommand(0, 'forward');
						expect(model.getMap().tanks[1].status).toEqual('static');
					});
					it('bumps the wall if the tank is hitting a wall', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 + direction.x, y: 2 + direction.y, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');
						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(170);

						expect(model.getMap().walls[0].strength).toEqual(100);
						expect(model.getMap().walls[1].strength).toEqual(50);
					});
					it('destroys a wall if strength less than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 + direction.x, y: 2 + direction.y, strength: 20}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(170);

						expect(model.getMap().walls[0].strength).toEqual(100);
						expect(model.getMap().walls.length).toEqual(1);
					});
					it('bumps another tank if it is in front', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}, {x : 1 + direction.x, y: 2 + direction.y, strength: 100}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(150);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(50);
					});
					it('destroys itself bumping a wall if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 25, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 + direction.x, y: 2 + direction.y, strength: 20}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(0);
					});
					it('destroys itself bumping tank if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 20, direction: direction.name}, {x : 1 + direction.x, y: 2 + direction.y, strength: 100}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(0);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(50);

					});
					it('destroys a bumped tank if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}, {x : 1 + direction.x, y: 2 + direction.y, strength: 30}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'forward');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + direction.name);
						expect(model.getMap().tanks[0].strength).toEqual(150);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(0);

					});
				});
				describe('reverse', function () {
					var reverseDirection = {
						top: 'bottom',
						bottom: 'top',
						right: 'left',
						left: 'right'
					};
					it('moves tank by 1 place if space is available', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 100, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5
						});
						model.executeCommand(0, 'reverse');
						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1 - direction.x);
						expect(model.getMap().tanks[0].y).toEqual(2 - direction.y);
						expect(model.getMap().tanks[0].strength).toEqual(100);
						expect(model.getMap().tanks[0].status).toEqual('moving');
					});
					it('resets status for all other tanks', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 100, direction: direction.name}, { x: 4, y: 4, status: 'moving'}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5
						});
						model.executeCommand(0, 'reverse');
						expect(model.getMap().tanks[1].status).toEqual('static');
					});
					it('bumps the wall if the tank is hitting a wall', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 - direction.x, y: 2 - direction.y, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');
						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(170);

						expect(model.getMap().walls[0].strength).toEqual(100);
						expect(model.getMap().walls[1].strength).toEqual(50);
					});
					it('destroys a wall if strength less than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 - direction.x, y: 2 - direction.y, strength: 20}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(170);

						expect(model.getMap().walls[0].strength).toEqual(100);
						expect(model.getMap().walls.length).toEqual(1);
					});
					it('bumps another tank if it is in front', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}, {x : 1 - direction.x, y: 2 - direction.y, strength: 100}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(150);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(50);
					});
					it('destroys itself bumping a wall if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 25, direction: direction.name}],
							walls: [{x: 3, y: 3, strength: 100}, {x: 1 - direction.x, y: 2 - direction.y, strength: 20}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(0);
					});
					it('destroys itself bumping tank if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 20, direction: direction.name}, {x : 1 - direction.x, y: 2 - direction.y, strength: 100}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(0);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(50);

					});
					it('destroys a bumped tank if less strength than damage', function () {
						var model = new TankWarsModel({
							tanks: [{x: 1, y: 2, strength: 200, direction: direction.name}, {x : 1 - direction.x, y: 2 - direction.y, strength: 30}],
							walls: [{x: 3, y: 3, strength: 100}],
							mapWidth: 5,
							mapHeight: 5,
							wallDamage: 30,
							tankDamage: 50
						});
						model.executeCommand(0, 'reverse');

						expect(model.getMap().tanks[0].direction).toEqual(direction.name);
						expect(model.getMap().tanks[0].x).toEqual(1);
						expect(model.getMap().tanks[0].y).toEqual(2);
						expect(model.getMap().tanks[0].status).toEqual('bump-' + reverseDirection[direction.name]);
						expect(model.getMap().tanks[0].strength).toEqual(150);

						expect(model.getMap().tanks[1].status).toEqual('bumped');
						expect(model.getMap().tanks[1].strength).toEqual(0);

					});
				});
			});
		});
	});
});
