/*

My project is a top-down
Dodgem Arena which i created
with p5.js for rendering and
Matter.js for the physics
simulation. The game uses a
fixed 1400 by 700 pixel arena
with a thick static barrier
around the outside. The barrier
and all cars are Matter.js
bodies, so rebounds, collisions,
friction, and movement are
handled through the physics
engine rather than only by
manual position changes. The
arena walls use high restitution
so that cars bounce away strongly
on impact, while the cars have
friction, air resistance and
density values to stop them from
sliding endlessly.

The player car is controlled
with force-based acceleration.
The up and down arrow keys apply
forward or reverse force in the
direction the car is facing,
while the left and right arrows
steer the car. I also added
maximum forward and reverse
speeds so the car remains
responsive and playable. The
player is inserted by pressing I
and clicking inside the player
bay, with checks to make sure
the spawn is inside the Start
Zone and does not overlap another
car. The player car is visually
different from the opponents,
making it easy to identify. There
are two opponent types: standard
cars and slow cars. The slow cars
use heavier-feeling physics and
lower target speed, so they
behave differently from the
standard cars.

The game includes the three
required arena modes. In Mode 1,
four opponent cars are parked
statically in the Start Zone,
allowing the player to practise
driving and insertion. In Mode 2,
four opponents spawn at random
non-overlapping positions with
random headings, then continue
along straight paths. In Mode 3,
the opponents use the same random
spawning system, but their
movement is modified with a
sine-wave path. This makes the
advanced mode more challenging
while still keeping the cars at
an approximately constant speed.
Opponent collision behaviour is
also handled consistently wall
contact reverses their heading,
and car contact changes their
direction.

The required animations are
separated into clear update and
draw functions. Moving cars leave
fading speed-based trails, car
collisions create impact flashes,
and wall collisions create
barrier pulses. These effects
help show what the physics system
is doing and make the game feel
more reactive. I also added extra
visual polish such as headlights,
boost trails, shield effects,
mode banners and special wave
trails for advanced opponents.

For the creative extension, I
built the arena into a more
complete arcade-style game. Boost
pads launch cars through the
arena, shield gates give temporary
protection, and reactor overdrive
changes the feel of the match
after enough collision energy is
built up. I also added score
rings, near-miss rewards, a
30-second run timer, crowd-style
wall flashes, a live HUD and a
result screen. These additions
create goals, risk-reward choices
and clearer feedback for the
player, making the project feel
like a finished game rather than
only a driving simulation.
*/

var engine;
var world;

// Arena 1400 by 700
var arenaWidth = 1400;
var arenaHeight = 700;
var wallThickness = 38;
var startZoneWidth = 270;
var parkingSpotX = 124;
var firstParkingY = 118;
var parkingGap = 112;
var parkingSpotWidth = 162;
var parkingSpotHeight = 70;

var carNumbers = 4;
var launchBayCount = carNumbers + 1;

var viewScale = 1;
var viewX = 0;
var viewY = 0;
var uiPanelWidth = 285;
var uiPanelMargin = 22;

var arenaWalls = [];
var allCars = [];

var playerCar = null;
var currentMode = 1;
var opponents = [];
var modeBannerText = "";
var modeBannerSubtext = "";
var modeBannerTimer = 0;
var modeBannerDuration = 90;

var insertArmed = false;
var playerSpawnRadius = 48;

var playerForwardForce = 0.0029;
var playerReverseForce = 0.00195;
var playerTurnRate = 0.068;
var playerMaxForwardSpeed = 13.2;
var playerMaxReverseSpeed = 8.2;

var opponentStandardSpeed = 5.35;
var opponentSlowSpeed = 3.65;
var opponentSpawnClearance = 120;
var opponentTurnCooldown = 16;
var trailSampleRate = 2;
var impactFlashes = [];
var barrierPulses = [];
var advancedWaveStrength = 0.55;
var shockwaves = [];
var shockwaveMinRelativeSpeed = 3.5;
var boostPads = [];
var boostBursts = [];
var energyGates = [];
var gateBursts = [];
var shieldGates = [];
var shieldBursts = [];
var boostCooldown = 55;
var boostMultiplier = 1.75;

// Reactor overdrive rewards repeated collisions without making it permanent.
var reactorCharge = 0;
var reactorMaxCharge = 100;
var reactorState = "charging";
var reactorTimer = 0;
var reactorOverdriveTime = 360;
var reactorCooldownTime = 180;
var reactorPulse = 0;

var shieldGateTimer = 10 * 60;
var shieldGateSpawnDelay = 10 * 60;
var shieldGateLifetime = 12 * 60;
var shieldGateCount = 2;
var shieldDuration = 8 * 60;

var arenaMusic = null;
var musicReady = false;
var musicStarted = false;
var musicMuted = false;
var musicCurrentVolume = -1;
var musicBaseVolume = 0.68;
var musicOverdriveVolume = 0.85;

var gameScore = 0;
var bestScore = 0;
var roundDuration = 30 * 60;
var roundTimer = roundDuration;
var roundActive = false;
var roundFinished = false;
var collisionCount = 0;
var boostUseCount = 0;
var shieldPickupCount = 0;
var nearMissCount = 0;
var comboCount = 0;
var comboTimer = 0;
var comboWindow = 120;
var nearMissDistance = 102;
var nearMissSafeDistance = 58;
var nearMissCooldown = 80;
var floatingScores = [];
var nearMissGlows = [];
var scoreRing = null;
var scoreRingSpawnTimer = 2 * 60;
var scoreRingSpawnDelay = 4 * 60;
var scoreRingLifetime = 5 * 60;
var scoreRingRadius = 56;
var crowdFlashTimer = 0;
var crowdFlashDuration = 30;
var crowdFlashStrength = 1;

function preload() {
  if (typeof loadSound !== "function") {
    return;
  }

  // Loads the arena loop.
  arenaMusic = loadSound(
    "assets/arena_loop.mp3",
    function () {
      musicReady = true;
    },
    function () {
      arenaMusic = null;
      musicReady = false;
    }
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont("Segoe UI");

  // Matter.js owns collision and movement.
  engine = Matter.Engine.create();
  world = engine.world;

  // Top-down bumper cars do not need gravity.
  engine.gravity.x = 0;
  engine.gravity.y = 0;

  // Static arena parts.
  createArenaWalls();
  createBoostPads();
  createEnergyGates();
  resetRunStats();
  setupModeOne();
  registerCollisionEvents();
}

function draw() {
  // Game state.
  updateOpponents();
  updateArenaView();
  updatePlayerControls();

  // Inputs are applied before the physics.
  Matter.Engine.update(engine, 1000 / 60);
  updateCarTrails();
  updateImpactFlashes();
  updateBarrierPulses();
  updateShockwaves();
  updateBoostPads();
  updateBoostBursts();
  updateReactorSystem();
  updateShieldGate();
  updateArenaMusic();
  updateRunStats();
  updateModeBanner();

  limitPlayerSpeed();

  drawBackgroundPattern();

  // The arena is drawn.
  push();
  translate(viewX, viewY);
  scale(viewScale);

  drawArenaFloor();
  drawArenaDecor();
  drawScanBeams();
  drawEnergyGates();
  drawShieldGate();
  drawBoostPads();
  drawScoreRing();
  drawStartZone();
  drawInsertionPreview();
  drawAllCarTrails();
  drawAllCars();
  drawNearMissGlows();
  drawImpactFlashes();
  drawBoostBursts();
  drawGateBursts();
  drawShieldBursts();
  drawShockwaves();
  drawFloatingScores();
  drawArenaWalls();
  drawBarrierPulses();

  pop();

  drawArenaRunHud();
  drawInterfaceText();
  drawModeBanner();
  drawRoundResultOverlay();
}

function createArenaWalls() {
  // The four Matter bodies form the arena boundary.
  var wallSettings = {
    isStatic: true,
    restitution: 0.95,
    friction: 0.02,
    frictionStatic: 0,
    label: "arena-wall"
  };

  var topWall = Matter.Bodies.rectangle(
    arenaWidth / 2,
    wallThickness / 2,
    arenaWidth,
    wallThickness,
    wallSettings
  );

  var bottomWall = Matter.Bodies.rectangle(
    arenaWidth / 2,
    arenaHeight - wallThickness / 2,
    arenaWidth,
    wallThickness,
    wallSettings
  );

  var leftWall = Matter.Bodies.rectangle(
    wallThickness / 2,
    arenaHeight / 2,
    wallThickness,
    arenaHeight,
    wallSettings
  );

  var rightWall = Matter.Bodies.rectangle(
    arenaWidth - wallThickness / 2,
    arenaHeight / 2,
    wallThickness,
    arenaHeight,
    wallSettings
  );

  arenaWalls = [topWall, bottomWall, leftWall, rightWall];
  Matter.World.add(world, arenaWalls);
}

function createBoostPads() {
  // Boost pads.
  boostPads = [
    { x: 470, y: 195, angle: 0.05, radius: 58, color: color(70, 156, 222) },
    { x: 805, y: 505, angle: -0.12, radius: 58, color: color(239, 105, 86) },
    { x: 1020, y: 250, angle: PI, radius: 58, color: color(245, 178, 73) }
  ];
}

function createEnergyGates() {
  // Energy gates only become active during reactor overdrive.
  energyGates = [
    { x: 610, y: 330, angle: -0.28, radius: 70, color: color(245, 178, 73) },
    { x: 930, y: 255, angle: 0.38, radius: 70, color: color(70, 156, 222) },
    { x: 1120, y: 465, angle: PI + 0.2, radius: 70, color: color(239, 105, 86) }
  ];
}

function clearCars() {
  // car bodies.
  for (var i = 0; i < allCars.length; i++) {
    Matter.World.remove(world, allCars[i].body);
  }

  allCars = [];
  opponents = [];
  playerCar = null;
  insertArmed = false;
  impactFlashes = [];
  barrierPulses = [];
  shockwaves = [];
  boostBursts = [];
  gateBursts = [];
  shieldGates = [];
  shieldBursts = [];
  shieldGateTimer = shieldGateSpawnDelay;
}

function loadMode(modeNumber) {
  // A mode change starts a new run.
  clearCars();
  resetRunStats();
  currentMode = modeNumber;
  showModeBanner(modeNumber);

  if (currentMode === 1) {
    setupModeOne();
  }

  if (currentMode === 2) {
    setupModeTwo();
  }

  if (currentMode === 3) {
    setupModeThree();
  }
}

function setupModeOne() {
  opponents = [];

  for (var i = 0; i < carNumbers; i++) {
    // The first two cars are standard rivals; the last two are slower and heavier.
    var carType = "standard";
    var carColor = color(255, 86, 112);

    if (i >= 2) {
      carType = "slow";
      carColor = color(245, 178, 73);
    }

    var parkedCar = new Car(
      parkingSpotX,
      firstParkingY + i * parkingGap,
      0,
      carType,
      carColor
    );

    // In Practice mode the opponent cars begin parked in the bay.
    Matter.Body.setStatic(parkedCar.body, true);

    opponents.push(parkedCar);
    allCars.push(parkedCar);
  }
}

function setupModeTwo() {
  opponents = [];

  for (var i = 0; i < carNumbers; i++) {
    // Mode 2 uses the same car mix but starts them in free arena space.
    var carType = "standard";
    var carColor = color(255, 86, 112);

    if (i >= 2) {
      carType = "slow";
      carColor = color(245, 178, 73);
    }

    var spawnPoint = findRandomOpponentSpawn();
    var heading = random(TWO_PI);

    // Mode 2 starts each rival in a random position.
    var opponent = new Car(
      spawnPoint.x,
      spawnPoint.y,
      heading,
      carType,
      carColor
    );

    opponent.targetSpeed = getOpponentSpeed(carType);
    opponent.pathHeading = heading;

    Matter.Body.setVelocity(opponent.body, {
      x: cos(heading) * opponent.targetSpeed,
      y: sin(heading) * opponent.targetSpeed
    });

    opponents.push(opponent);
    allCars.push(opponent);
  }
}

function setupModeThree() {
  opponents = [];

  for (var i = 0; i < carNumbers; i++) {
    // Mode 3 keeps the car mix familiar, then changes the movement pattern.
    var carType = "standard";
    var carColor = color(255, 86, 112);

    if (i >= 2) {
      carType = "slow";
      carColor = color(245, 178, 73);
    }

    var spawnPoint = findRandomOpponentSpawn();
    var heading = random(TWO_PI);

    // Mode 3 uses the same random spawn, then adds sine-wave motion values.
    var opponent = new Car(
      spawnPoint.x,
      spawnPoint.y,
      heading,
      carType,
      carColor
    );

    opponent.targetSpeed = getOpponentSpeed(carType);
    opponent.pathHeading = heading;
    opponent.wavePhase = random(TWO_PI);
    opponent.waveFrequency = random(0.018, 0.032);
    opponent.waveStrength = advancedWaveStrength + random(-0.12, 0.16);

    Matter.Body.setVelocity(opponent.body, {
      x: cos(heading) * opponent.targetSpeed,
      y: sin(heading) * opponent.targetSpeed
    });

    opponents.push(opponent);
    allCars.push(opponent);
  }
}

function findRandomOpponentSpawn() {
  // Random modes keep trying positions until the car has enough clear space.
  for (var attempt = 0; attempt < 300; attempt++) {
    var x = random(startZoneWidth + 90, arenaWidth - wallThickness - 90);
    var y = random(wallThickness + 80, arenaHeight - wallThickness - 80);

    if (isAreaClearForCar(x, y, opponentSpawnClearance)) {
      return { x: x, y: y };
    }
  }

  // Fallback position.
  return {
    x: startZoneWidth + 160,
    y: arenaHeight / 2
  };
}

function updateOpponents() {
  if (currentMode !== 2 && currentMode !== 3) {
    return;
  }

  // Only moving modes need  opponent movement each frame.
  for (var i = 0; i < opponents.length; i++) {
    if (currentMode === 2) {
      keepOpponentMovingStraight(opponents[i]);
    }

    if (currentMode === 3) {
      keepOpponentMovingWave(opponents[i]);
    }
  }
}

function keepOpponentMovingStraight(car) {
  var body = car.body;
  var speed = car.targetSpeed;

  if (car.boostUntil > frameCount) {
    speed *= getBoostMultiplier();
  }

  if (car.pathHeading === undefined) {
    car.pathHeading = body.angle;
  }

  handleSimpleWallTurn(car);

  // Mode 2 opponents keep a straight heading instead of steering like the player.
  Matter.Body.setAngle(body, car.pathHeading);
  Matter.Body.setVelocity(body, {
    x: cos(car.pathHeading) * speed,
    y: sin(car.pathHeading) * speed
  });

  Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.6);
}

function keepOpponentMovingWave(car) {
  var body = car.body;
  var speed = car.targetSpeed;

  if (car.boostUntil > frameCount) {
    speed *= getBoostMultiplier();
  }

  if (car.pathHeading === undefined) {
    car.pathHeading = body.angle;
  }

  handleSimpleWallTurn(car);

  // Mode 3 bends each car, giving a sine-wave path.
  var waveAngle = sin(frameCount * car.waveFrequency + car.wavePhase) * car.waveStrength;
  var movementAngle = car.pathHeading + waveAngle;

  Matter.Body.setAngle(body, movementAngle);
  Matter.Body.setVelocity(body, {
    x: cos(movementAngle) * speed,
    y: sin(movementAngle) * speed
  });

  Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.4);
}

function handleSimpleWallTurn(car) {
  var body = car.body;
  var margin = wallThickness + 46;

  if (body.position.x < margin ||
      body.position.x > arenaWidth - margin ||
      body.position.y < margin ||
      body.position.y > arenaHeight - margin) {
    turnOpponent(car, PI);
  }
}

function getOpponentSpeed(carType) {
  if (carType === "slow") {
    return opponentSlowSpeed;
  }

  return opponentStandardSpeed;
}

function isAreaClearForCar(x, y, clearance) {
  // This protects random spawning and player insertion from overlapping cars.
  for (var i = 0; i < allCars.length; i++) {
    var carPosition = allCars[i].body.position;

    if (dist(x, y, carPosition.x, carPosition.y) < clearance) {
      return false;
    }
  }

  return true;
}

function registerCollisionEvents() {
  // Matter.js sends all collision pairs the handler.
  Matter.Events.on(engine, "collisionStart", function (event) {
    for (var i = 0; i < event.pairs.length; i++) {
      handleCollisionPair(event.pairs[i]);
    }
  });
}

function handleCollisionPair(pair) {
  var opponentA = getOpponentFromBody(pair.bodyA);
  var opponentB = getOpponentFromBody(pair.bodyB);

  // Collision effects are kept separate.
  // This keeps the visual feedback independent from the opponent steering rules.
  if (isCarBody(pair.bodyA) && isCarBody(pair.bodyB)) {
    createImpactFlash(pair);
    createShockwave(pair);
    chargeReactorFromHit(pair);
  }

  if (isCarBody(pair.bodyA) && pair.bodyB.label === "arena-wall") {
    createBarrierPulse(pair, pair.bodyB, pair.bodyA);
    chargeReactorFromHit(pair);
  }

  if (isCarBody(pair.bodyB) && pair.bodyA.label === "arena-wall") {
    createBarrierPulse(pair, pair.bodyA, pair.bodyB);
    chargeReactorFromHit(pair);
  }

  scorePlayerCrash(pair);

  // Opponents reverse on walls and turn sideways after car contact.
  if (opponentA !== null && pair.bodyB.label === "arena-wall") {
    turnOpponent(opponentA, PI);
  }

  if (opponentB !== null && pair.bodyA.label === "arena-wall") {
    turnOpponent(opponentB, PI);
  }

  if (opponentA !== null && isCarBody(pair.bodyB)) {
    turnOpponent(opponentA, randomTurnAngle());
  }

  if (opponentB !== null && isCarBody(pair.bodyA)) {
    turnOpponent(opponentB, randomTurnAngle());
  }
}

function chargeReactorFromHit(pair) {
  if (reactorState !== "charging") {
    return;
  }

  var impactSpeed = getImpactSpeed(pair);

  if (impactSpeed < 1.8) {
    return;
  }

  // Solid impacts are the fuel for the arena's overdrive system.
  reactorCharge += constrain(impactSpeed * 2.35, 4, 16);
  reactorPulse = 22;

  if (reactorCharge >= reactorMaxCharge) {
    startReactorOverdrive();
  }
}

function getImpactSpeed(pair) {
  if (isCarBody(pair.bodyA) && isCarBody(pair.bodyB)) {
    return getRelativeCollisionSpeed(pair.bodyA, pair.bodyB);
  }

  var carBody = null;

  if (isCarBody(pair.bodyA)) {
    carBody = pair.bodyA;
  }

  if (isCarBody(pair.bodyB)) {
    carBody = pair.bodyB;
  }

  if (carBody === null) {
    return 0;
  }

  return sqrt(
    carBody.velocity.x * carBody.velocity.x +
    carBody.velocity.y * carBody.velocity.y
  );
}

function resetRunStats() {
  // Reset only run-based values so best score and selected mode can stay available.
  gameScore = 0;
  roundTimer = roundDuration;
  roundActive = false;
  roundFinished = false;
  collisionCount = 0;
  boostUseCount = 0;
  shieldPickupCount = 0;
  nearMissCount = 0;
  comboCount = 0;
  comboTimer = 0;
  floatingScores = [];
  nearMissGlows = [];
  scoreRing = null;
  scoreRingSpawnTimer = 2 * 60;
  crowdFlashTimer = 0;
}

function startRunTimer() {
  roundTimer = roundDuration;
  roundActive = true;
  roundFinished = false;
}

function finishRun() {
  roundTimer = 0;
  roundActive = false;
  roundFinished = true;
  bestScore = max(bestScore, gameScore);
  comboCount = 0;
  comboTimer = 0;
  scoreRing = null;
}

function updateRunStats() {
  // The combo timer makes near-miss chains temporary instead of permanent.
  if (comboTimer > 0) {
    comboTimer--;
  } else {
    comboCount = 0;
  }

  updateNearMisses();
  updateFloatingScores();
  updateNearMissGlows();
  updateScoreRing();
  updateCrowdFlash();

  if (!roundActive) {
    return;
  }

  roundTimer--;

  if (roundTimer <= 0) {
    finishRun();
  }
}

function updateNearMisses() {
  if (!roundActive || roundFinished || playerCar === null) {
    return;
  }

  // A near miss is rewarded only when the player is close but not actually touching.
  var playerPosition = playerCar.body.position;

  for (var i = 0; i < opponents.length; i++) {
    var opponent = opponents[i];
    var opponentPosition = opponent.body.position;
    var distanceToOpponent = dist(
      playerPosition.x,
      playerPosition.y,
      opponentPosition.x,
      opponentPosition.y
    );

    if (distanceToOpponent > nearMissSafeDistance &&
        distanceToOpponent < nearMissDistance &&
        frameCount - opponent.lastNearMissFrame > nearMissCooldown) {
      opponent.lastNearMissFrame = frameCount;
      nearMissCount++;
      comboCount++;
      comboTimer = comboWindow;

      var bonus = 35 + comboCount * 10;
      addPlayerScore(
        bonus,
        "NEAR MISS x" + comboCount + " +" + bonus,
        playerPosition.x,
        playerPosition.y - 36,
        color(245, 178, 73)
      );
      addNearMissGlow(playerPosition, opponentPosition, comboCount);
      triggerCrowdFlash(comboCount);
    }
  }
}

function scorePlayerCrash(pair) {
  if (!roundActive || roundFinished || playerCar === null) {
    return;
  }

  var playerBody = playerCar.body;

  if (pair.bodyA !== playerBody && pair.bodyB !== playerBody) {
    return;
  }

  var impactSpeed = getImpactSpeed(pair);

  if (impactSpeed < 2.2) {
    return;
  }

  var point = getCollisionPoint(pair);
  collisionCount++;
  comboCount = 0;
  comboTimer = 0;

  // Shielded crashes give feedback.
  if (isCarShielded(playerCar)) {
    addFloatingScoreText("SHIELD BLOCK", point.x, point.y - 28, color(112, 214, 164));
    return;
  }

  addPlayerScore(-35, "CRASH -35", point.x, point.y - 28, color(239, 105, 86));
}

function addPlayerScore(points, label, x, y, labelColor) {
  if (!roundActive || roundFinished || playerCar === null) {
    return;
  }

  // Scores never go below zero, so crashes punish without ending the run.
  gameScore = max(0, gameScore + points);
  bestScore = max(bestScore, gameScore);
  addFloatingScoreText(label, x, y, labelColor);
}

function addNearMissGlow(playerPosition, opponentPosition, comboValue) {
  nearMissGlows.push({
    x: (playerPosition.x + opponentPosition.x) / 2,
    y: (playerPosition.y + opponentPosition.y) / 2,
    combo: comboValue,
    age: 0,
    life: 34
  });

  if (nearMissGlows.length > 10) {
    nearMissGlows.shift();
  }
}

function updateNearMissGlows() {
  for (var i = nearMissGlows.length - 1; i >= 0; i--) {
    nearMissGlows[i].age++;

    if (nearMissGlows[i].age > nearMissGlows[i].life) {
      nearMissGlows.splice(i, 1);
    }
  }
}

function drawNearMissGlows() {
  for (var i = 0; i < nearMissGlows.length; i++) {
    var glow = nearMissGlows[i];
    var progress = glow.age / glow.life;
    var alpha = map(progress, 0, 1, 185, 0);
    var radius = map(progress, 0, 1, 34, 116);

    noFill();
    stroke(245, 178, 73, alpha);
    strokeWeight(4);
    ellipse(glow.x, glow.y, radius * 1.45, radius);

    stroke(70, 156, 222, alpha * 0.75);
    strokeWeight(2);
    ellipse(glow.x, glow.y, radius * 0.92, radius * 0.58);

    noStroke();
    fill(245, 178, 73, alpha);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(12);
    text("CLEAN DODGE", glow.x, glow.y);
    textStyle(NORMAL);
  }
}

function updateScoreRing() {
  // Score rings give the player a bonus target during the timed run.
  if (!roundActive || roundFinished || playerCar === null) {
    return;
  }

  if (scoreRing === null) {
    // When no ring is active, the spawn timer counts down quietly.
    scoreRingSpawnTimer--;

    if (scoreRingSpawnTimer <= 0) {
      spawnScoreRing();
    }

    return;
  }

  scoreRing.update();

  if (scoreRing.isFinished()) {
    scoreRing = null;
    scoreRingSpawnTimer = scoreRingSpawnDelay;
    return;
  }

  if (scoreRing.touches(playerCar)) {
    collectScoreRing();
  }
}

function spawnScoreRing() {
  var spawnPoint = findScoreRingSpawnPoint();

  // The ring itself handles lifetime, pickup testing, reward and drawing.
  scoreRing = new ScoreRing(spawnPoint.x, spawnPoint.y);
}

function findScoreRingSpawnPoint() {
  for (var attempt = 0; attempt < 120; attempt++) {
    var x = random(startZoneWidth + 150, arenaWidth - wallThickness - 110);
    var y = random(wallThickness + 90, arenaHeight - wallThickness - 90);

    if (isAreaClearForCar(x, y, 120)) {
      return { x: x, y: y };
    }
  }

  return {
    x: arenaWidth * 0.68,
    y: arenaHeight * 0.42
  };
}

// ScoreRing owns the bonus target's timing, pickup check, reward and drawing.
class ScoreRing {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.life = scoreRingLifetime;
    this.radius = scoreRingRadius;
  }

  update() {
    this.life--;
  }

  isFinished() {
    return this.life <= 0;
  }

  touches(car) {
    var carPosition = car.body.position;

    return dist(carPosition.x, carPosition.y, this.x, this.y) < this.radius;
  }

  collect() {
    // Ring value doubles during overdrive, encouraging risky fast play.
    var ringBonus = isReactorOverdrive() ? 200 : 100;

    addPlayerScore(
      ringBonus,
      "RING +" + ringBonus,
      this.x,
      this.y - 36,
      color(245, 178, 73)
    );

    triggerCrowdFlash(3);
  }

  draw() {
    var lifeRatio = constrain(this.life / scoreRingLifetime, 0, 1);
    var pulse = sin(frameCount * 0.14) * 7;
    var ringColor = isReactorOverdrive() ? color(239, 105, 86) : color(245, 178, 73);

    push();
    translate(this.x, this.y);

    noFill();
    stroke(red(ringColor), green(ringColor), blue(ringColor), 210);
    strokeWeight(5);
    ellipse(0, 0, this.radius * 2 + pulse, this.radius * 2 + pulse);

    stroke(70, 156, 222, 115);
    strokeWeight(2);
    ellipse(
      0,
      0,
      this.radius * 1.35 - pulse * 0.35,
      this.radius * 1.35 - pulse * 0.35
    );

    noStroke();
    fill(230, 238, 246, 210);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(12);
    text(isReactorOverdrive() ? "+200" : "+100", 0, 0);

    fill(255, 255, 255, 70 * lifeRatio);
    ellipse(0, 0, this.radius * 0.45, this.radius * 0.45);

    pop();
    textStyle(NORMAL);
  }
}

function collectScoreRing() {
  scoreRing.collect();

  scoreRing = null;
  scoreRingSpawnTimer = scoreRingSpawnDelay;
}

function drawScoreRing() {
  if (scoreRing === null) {
    return;
  }

  scoreRing.draw();
}

function triggerCrowdFlash(comboValue) {
  // A stronger combo makes the arena border flash harder for instant feedback.
  crowdFlashTimer = crowdFlashDuration;
  crowdFlashStrength = constrain(comboValue, 1, 8);
}

function updateCrowdFlash() {
  if (crowdFlashTimer > 0) {
    crowdFlashTimer--;
  }
}

// FloatingScore owns a short-lived score popup's timing and drawing.
class FloatingScore {
  constructor(label, x, y, labelColor) {
    this.text = label;
    this.x = x;
    this.y = y;
    this.color = labelColor;
    this.age = 0;
    this.life = 54;
  }

  update() {
    this.age++;
  }

  isFinished() {
    return this.age > this.life;
  }

  draw() {
    var progress = this.age / this.life;
    var alpha = map(progress, 0, 1, 235, 0);
    var rise = progress * 34;
    var drawY = this.y - rise;

    // The shadow keeps score text readable over bright arena effects.
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(15);
    fill(0, 0, 0, alpha * 0.42);
    text(this.text, this.x + 2, drawY + 2);

    fill(red(this.color), green(this.color), blue(this.color), alpha);
    text(this.text, this.x, drawY);
  }
}

function addFloatingScoreText(label, x, y, labelColor) {
  floatingScores.push(new FloatingScore(label, x, y, labelColor));

  if (floatingScores.length > 16) {
    floatingScores.shift();
  }
}

function updateFloatingScores() {
  for (var i = floatingScores.length - 1; i >= 0; i--) {
    floatingScores[i].update();

    if (floatingScores[i].isFinished()) {
      floatingScores.splice(i, 1);
    }
  }
}

function drawFloatingScores() {
  for (var i = 0; i < floatingScores.length; i++) {
    floatingScores[i].draw();
  }

  textStyle(NORMAL);
}

function startReactorOverdrive() {
  // Overdrive is a temporary reward state, so it uses a countdown timer.
  reactorState = "overdrive";
  reactorCharge = reactorMaxCharge;
  reactorTimer = reactorOverdriveTime;
  reactorPulse = 70;
}

function updateReactorSystem() {
  // The reactor moves through charging, overdrive, then cooling before charging again.
  if (reactorPulse > 0) {
    reactorPulse *= 0.86;
  }

  if (reactorState === "overdrive") {
    reactorTimer--;

    if (reactorTimer <= 0) {
      reactorState = "cooling";
      reactorTimer = reactorCooldownTime;
      reactorCharge = 0;
    }
  } else if (reactorState === "cooling") {
    reactorTimer--;

    if (reactorTimer <= 0) {
      reactorState = "charging";
      reactorTimer = 0;
    }
  }

  if (isReactorOverdrive()) {
    // Energy gates are a special reward for filling the reactor charge.
    updateEnergyGates();
  }

  updateGateBursts();
}

function updateEnergyGates() {
  // Static practice cars cannot trigger gates while parked in the launch bay.
  for (var i = 0; i < allCars.length; i++) {
    if (allCars[i].body.isStatic) {
      continue;
    }

    for (var j = 0; j < energyGates.length; j++) {
      if (dist(
          allCars[i].body.position.x,
          allCars[i].body.position.y,
          energyGates[j].x,
          energyGates[j].y
        ) < energyGates[j].radius) {
        triggerEnergyGate(allCars[i], energyGates[j]);
      }
    }
  }
}

function triggerEnergyGate(car, gate) {
  if (frameCount - car.lastGateFrame < 55) {
    return;
  }

  // Gates push the car in their arrow direction instead of just adding score.
  var body = car.body;
  var launchPower = 6.2;

  Matter.Body.setVelocity(body, {
    x: body.velocity.x + cos(gate.angle) * launchPower,
    y: body.velocity.y + sin(gate.angle) * launchPower
  });

  Matter.Body.setAngle(body, gate.angle);
  car.pathHeading = gate.angle;
  car.lastGateFrame = frameCount;
  car.boostUntil = max(car.boostUntil, frameCount + 30);

  if (car === playerCar) {
    addPlayerScore(35, "GATE +35", gate.x, gate.y - 34, color(70, 156, 222));
  }

  gateBursts.push({
    x: gate.x,
    y: gate.y,
    angle: gate.angle,
    color: gate.color,
    age: 0,
    life: 26
  });

  if (gateBursts.length > 10) {
    gateBursts.shift();
  }
}

function updateGateBursts() {
  for (var i = gateBursts.length - 1; i >= 0; i--) {
    gateBursts[i].age++;

    if (gateBursts[i].age > gateBursts[i].life) {
      gateBursts.splice(i, 1);
    }
  }
}

function isReactorOverdrive() {
  return reactorState === "overdrive";
}

function getBoostMultiplier() {
  if (isReactorOverdrive()) {
    return boostMultiplier * 1.25;
  }

  return boostMultiplier;
}

function updateShieldGate() {
  // Shield gates spawn on a timer, stay briefly, then reset after pickup or expiry.
  if (shieldGates.length === 0) {
    shieldGateTimer = max(0, shieldGateTimer - 1);

    if (shieldGateTimer === 0) {
      spawnShieldGates();
    }

    updateShieldBursts();
    return;
  }

  for (var gateIndex = shieldGates.length - 1; gateIndex >= 0; gateIndex--) {
    // Gates expire if nobody reaches them in time.
    shieldGates[gateIndex].update();

    if (shieldGates[gateIndex].isFinished()) {
      shieldGates.splice(gateIndex, 1);
    }
  }

  if (shieldGates.length === 0) {
    resetShieldGateTimer();
    updateShieldBursts();
    return;
  }

  for (var i = 0; i < allCars.length; i++) {
    var car = allCars[i];

    if (car.body.isStatic) {
      continue;
    }

    // Any moving car can collect a gate, but only the player earns score.
    for (var j = shieldGates.length - 1; j >= 0; j--) {
      if (shieldGates[j].touches(car)) {
        shieldGates[j].activate(car);
        shieldGates.splice(j, 1);

        if (shieldGates.length === 0) {
          resetShieldGateTimer();
        }

        updateShieldBursts();
        return;
      }
    }
  }

  updateShieldBursts();
}

function spawnShieldGates() {
  shieldGates = [];

  // Two gates make the player choose a route.
  for (var i = 0; i < shieldGateCount; i++) {
    var spawnPoint = findShieldGateSpawnPoint();
    var gateColor = i === 0 ? color(112, 214, 164) : color(150, 190, 232);

    shieldGates.push(new ShieldGate(spawnPoint.x, spawnPoint.y, gateColor));
  }
}

function findShieldGateSpawnPoint() {
  for (var attempt = 0; attempt < 120; attempt++) {
    var x = random(startZoneWidth + 190, arenaWidth - wallThickness - 120);
    var y = random(wallThickness + 100, arenaHeight - wallThickness - 100);

    if (isAreaClearForCar(x, y, 135) && isClearOfOtherShieldGates(x, y)) {
      return { x: x, y: y };
    }
  }

  return {
    x: arenaWidth * 0.72,
    y: arenaHeight * 0.48
  };
}

function isClearOfOtherShieldGates(x, y) {
  for (var i = 0; i < shieldGates.length; i++) {
    if (dist(x, y, shieldGates[i].x, shieldGates[i].y) < 220) {
      return false;
    }
  }

  return true;
}

// ShieldGate keeps the pickup rule, reward, burst effectand drawing together.
class ShieldGate {
  constructor(x, y, gateColor) {
    this.x = x;
    this.y = y;
    this.radius = 64;
    this.life = shieldGateLifetime;
    this.color = gateColor;
  }

  update() {
    this.life--;
  }

  isFinished() {
    return this.life <= 0;
  }

  touches(car) {
    var carPosition = car.body.position;

    return dist(carPosition.x, carPosition.y, this.x, this.y) < this.radius;
  }

  activate(car) {
    // The shield duration is stored on the car for quick collision checks.
    car.shieldUntil = frameCount + shieldDuration;
    car.lastShieldGateFrame = frameCount;

    if (car === playerCar) {
      shieldPickupCount++;
      addPlayerScore(60, "SHIELD +60", this.x, this.y - 36, color(112, 214, 164));
    }

    this.addBurst();
  }

  addBurst() {
    // The burst stays separate from the gate so it can keep fading after pickup.
    shieldBursts.push({
      x: this.x,
      y: this.y,
      age: 0,
      life: 32,
      color: this.color
    });
  }

  draw() {
    var pulse = sin(frameCount * 0.1) * 8;

    push();
    translate(this.x, this.y);

    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 34);
    ellipse(0, 0, this.radius * 2 + pulse, this.radius * 1.2 + pulse * 0.4);

    noFill();
    stroke(red(this.color), green(this.color), blue(this.color), 210);
    strokeWeight(4);
    arc(0, 0, this.radius * 1.55, this.radius * 1.55, -PI * 0.9, PI * 0.9);

    stroke(255, 255, 255, 160);
    strokeWeight(2);
    arc(0, 0, this.radius * 1.1, this.radius * 1.1, -PI * 0.75, PI * 0.75);

    noStroke();
    fill(112, 214, 164, 180);
    beginShape();
    vertex(0, -28);
    vertex(28, -14);
    vertex(22, 18);
    vertex(0, 34);
    vertex(-22, 18);
    vertex(-28, -14);
    endShape(CLOSE);

    fill(13, 22, 24, 185);
    ellipse(0, 2, 28, 24);

    pop();
  }
}

function resetShieldGateTimer() {
  shieldGates = [];
  shieldGateTimer = shieldGateSpawnDelay;
}

function updateShieldBursts() {
  for (var i = shieldBursts.length - 1; i >= 0; i--) {
    shieldBursts[i].age++;

    if (shieldBursts[i].age > shieldBursts[i].life) {
      shieldBursts.splice(i, 1);
    }
  }
}

function isCarShielded(car) {
  return car.shieldUntil > frameCount;
}

function getOpponentFromBody(body) {
  // Matter.js gives us bodies, so this maps them back to our Car objects.
  for (var i = 0; i < opponents.length; i++) {
    if (opponents[i].body === body) {
      return opponents[i];
    }
  }

  return null;
}

function isCarBody(body) {
  return body.label === "standard-car" || body.label === "slow-car";
}

function randomTurnAngle() {
  if (random() < 0.5) {
    return HALF_PI;
  }

  return -HALF_PI;
}

function turnOpponent(car, angleChange) {
  if (currentMode !== 2 && currentMode !== 3) {
    return;
  }

  if (frameCount - car.lastTurnFrame < opponentTurnCooldown) {
    return;
  }

  if (car.pathHeading === undefined) {
    car.pathHeading = car.body.angle;
  }

  // The cooldown stops opponents from spinning many times.
  car.pathHeading += angleChange;
  Matter.Body.setAngle(car.body, car.pathHeading);
  car.lastTurnFrame = frameCount;
}

function createImpactFlash(pair) {
  // Impact flashes mark the exact contact point so collisions read clearly.
  var point = getCollisionPoint(pair);

  // Each flash is a short-lived class instance instead of a loose data object.
  impactFlashes.push(new ImpactFlash(point.x, point.y));

  if (impactFlashes.length > 24) {
    impactFlashes.shift();
  }
}

function getCollisionPoint(pair) {
  // Matter sometimes provides support points, otherwise the midpoint is stable.
  if (pair.collision && pair.collision.supports && pair.collision.supports.length > 0) {
    return {
      x: pair.collision.supports[0].x,
      y: pair.collision.supports[0].y
    };
  }

  return {
    x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
    y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
  };
}

function updateImpactFlashes() {
  for (var i = impactFlashes.length - 1; i >= 0; i--) {
    impactFlashes[i].update();

    if (impactFlashes[i].isFinished()) {
      impactFlashes.splice(i, 1);
    }
  }
}

function drawImpactFlashes() {
  for (var i = 0; i < impactFlashes.length; i++) {
    impactFlashes[i].draw();
  }
}

// ImpactFlash owns one short collision burst from birth to fade-out.
class ImpactFlash {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.life = 18;
  }

  update() {
    this.age++;
  }

  isFinished() {
    return this.age > this.life;
  }

  draw() {
    var progress = this.age / this.life;
    var radius = map(progress, 0, 1, 8, 70);
    var alpha = map(progress, 0, 1, 230, 0);

    noFill();
    stroke(255, 236, 176, alpha);
    strokeWeight(4);
    ellipse(this.x, this.y, radius, radius);

    stroke(239, 105, 86, alpha * 0.7);
    strokeWeight(2);

    for (var a = 0; a < TWO_PI; a += HALF_PI) {
      line(
        this.x + cos(a) * radius * 0.25,
        this.y + sin(a) * radius * 0.25,
        this.x + cos(a) * radius * 0.55,
        this.y + sin(a) * radius * 0.55
      );
    }
  }
}

function createBarrierPulse(pair, wallBody, carBody) {
  // Barrier pulses make wall hits visible.
  var point = getCollisionPoint(pair);
  var speed = sqrt(
    carBody.velocity.x * carBody.velocity.x +
    carBody.velocity.y * carBody.velocity.y
  );

  // The pulse remembers which wall was hit so it can draw along that side.
  barrierPulses.push(new BarrierPulse(
    point.x,
    point.y,
    getWallSide(wallBody),
    constrain(speed * 34, 90, 230)
  ));

  if (barrierPulses.length > 20) {
    barrierPulses.shift();
  }
}

function getWallSide(wallBody) {
  if (wallBody.position.y < wallThickness) {
    return "top";
  }

  if (wallBody.position.y > arenaHeight - wallThickness) {
    return "bottom";
  }

  if (wallBody.position.x < wallThickness) {
    return "left";
  }

  return "right";
}

function updateBarrierPulses() {
  for (var i = barrierPulses.length - 1; i >= 0; i--) {
    barrierPulses[i].update();

    if (barrierPulses[i].isFinished()) {
      barrierPulses.splice(i, 1);
    }
  }
}

function drawBarrierPulses() {
  for (var i = 0; i < barrierPulses.length; i++) {
    barrierPulses[i].draw();
  }
}

// BarrierPulse owns one wall-hit glow and knows which wall side it belongs to.
class BarrierPulse {
  constructor(x, y, side, startAlpha) {
    this.x = x;
    this.y = y;
    this.side = side;
    this.age = 0;
    this.life = 24;
    this.alpha = startAlpha;
  }

  update() {
    this.age++;
  }

  isFinished() {
    return this.age > this.life;
  }

  draw() {
    // Horizontal and vertical walls need different line coordinates.
    var progress = this.age / this.life;
    var alpha = map(progress, 0, 1, this.alpha, 0);
    var glowLength = map(progress, 0, 1, 40, 220);
    var innerOffset = map(progress, 0, 1, 4, wallThickness * 0.8);

    if (this.side === "top" || this.side === "bottom") {
      this.drawHorizontalPulse(glowLength, innerOffset, alpha);
    } else {
      this.drawVerticalPulse(glowLength, innerOffset, alpha);
    }
  }

  drawHorizontalPulse(glowLength, innerOffset, alpha) {
    var wallY = this.side === "top" ? 0 : arenaHeight;
    var directionY = this.side === "top" ? 1 : -1;

    drawWallPulseLine(
      this.x,
      wallY + directionY * innerOffset,
      this.x - glowLength,
      this.x + glowLength,
      true,
      alpha
    );
  }

  drawVerticalPulse(glowLength, innerOffset, alpha) {
    var wallX = this.side === "left" ? 0 : arenaWidth;
    var directionX = this.side === "left" ? 1 : -1;

    drawWallPulseLine(
      this.y,
      wallX + directionX * innerOffset,
      this.y - glowLength,
      this.y + glowLength,
      false,
      alpha
    );
  }
}

function drawWallPulseLine(
  center,
  wallPosition,
  startPoint,
  endPoint,
  horizontal,
  alpha
) {
  stroke(70, 156, 222, alpha * 0.35);
  strokeWeight(14);

  if (horizontal) {
    line(startPoint, wallPosition, endPoint, wallPosition);
  } else {
    line(wallPosition, startPoint, wallPosition, endPoint);
  }

  stroke(255, 255, 255, alpha);
  strokeWeight(4);

  if (horizontal) {
    line(startPoint, wallPosition, endPoint, wallPosition);
  } else {
    line(wallPosition, startPoint, wallPosition, endPoint);
  }

  stroke(239, 105, 86, alpha * 0.65);
  strokeWeight(2);

  for (var offset = -36; offset <= 36; offset += 36) {
    if (horizontal) {
      line(center + offset, wallPosition - 10, center + offset, wallPosition + 10);
    } else {
      line(wallPosition - 10, center + offset, wallPosition + 10, center + offset);
    }
  }
}

function createShockwave(pair) {
  var relativeSpeed = getRelativeCollisionSpeed(pair.bodyA, pair.bodyB);

  // Small bumps already have impact flashes, so shockwaves are saved for big hits.
  if (relativeSpeed < shockwaveMinRelativeSpeed) {
    return;
  }

  // Only stronger car-to-car impacts create a shockwave.
  var point = getCollisionPoint(pair);
  var power = constrain(relativeSpeed, shockwaveMinRelativeSpeed, 12);

  shockwaves.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: 34,
    maxRadius: map(power, shockwaveMinRelativeSpeed, 12, 95, 220),
    force: map(power, shockwaveMinRelativeSpeed, 12, 0.00028, 0.0012)
  });

  if (shockwaves.length > 8) {
    shockwaves.shift();
  }
}

function getRelativeCollisionSpeed(bodyA, bodyB) {
  var dx = bodyA.velocity.x - bodyB.velocity.x;
  var dy = bodyA.velocity.y - bodyB.velocity.y;

  return sqrt(dx * dx + dy * dy);
}

function updateShockwaves() {
  for (var i = shockwaves.length - 1; i >= 0; i--) {
    shockwaves[i].age++;
    applyShockwaveForces(shockwaves[i]);

    if (shockwaves[i].age > shockwaves[i].life) {
      shockwaves.splice(i, 1);
    }
  }
}

function applyShockwaveForces(wave) {
  var progress = wave.age / wave.life;
  var radius = map(progress, 0, 1, 20, wave.maxRadius);
  var bandWidth = 46;

  for (var i = 0; i < allCars.length; i++) {
    var car = allCars[i];
    var body = car.body;

    if (body.isStatic || isCarShielded(car)) {
      continue;
    }

    var dx = body.position.x - wave.x;
    var dy = body.position.y - wave.y;
    var distanceFromCenter = sqrt(dx * dx + dy * dy);
    var distanceFromWave = abs(distanceFromCenter - radius);

    // Cars are pushed only when the expanding ring reaches them.
    if (distanceFromCenter > 1 && distanceFromWave < bandWidth) {
      var falloff = 1 - distanceFromWave / bandWidth;
      var forceAmount = wave.force * falloff * (1 - progress);

      Matter.Body.applyForce(body, body.position, {
        x: dx / distanceFromCenter * forceAmount,
        y: dy / distanceFromCenter * forceAmount
      });
    }
  }
}

function drawShockwaves() {
  for (var i = 0; i < shockwaves.length; i++) {
    var wave = shockwaves[i];
    var progress = wave.age / wave.life;
    var radius = map(progress, 0, 1, 20, wave.maxRadius);
    var alpha = map(progress, 0, 1, 120, 0);

    noFill();
    stroke(70, 156, 222, alpha);
    strokeWeight(5);
    ellipse(wave.x, wave.y, radius * 2, radius * 2);

    stroke(239, 105, 86, alpha * 0.55);
    strokeWeight(2);
    ellipse(wave.x, wave.y, radius * 1.35, radius * 1.35);
  }
}

function updatePlayerControls() {
  if (playerCar === null) {
    return;
  }

  // Forces are applied in the direction the car is facing.
  // This makes turning matter.
  var body = playerCar.body;
  var forward = {
    x: cos(body.angle),
    y: sin(body.angle)
  };

  var velocity = body.velocity;
  var speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  var forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;

  if (keyIsDown(UP_ARROW) && forwardSpeed < playerMaxForwardSpeed) {
    Matter.Body.applyForce(body, body.position, {
      x: forward.x * playerForwardForce,
      y: forward.y * playerForwardForce
    });
  }

  if (keyIsDown(DOWN_ARROW) && forwardSpeed > -playerMaxReverseSpeed) {
    Matter.Body.applyForce(body, body.position, {
      x: -forward.x * playerReverseForce,
      y: -forward.y * playerReverseForce
    });
  }

  updatePlayerSteering(body, speed, forwardSpeed);
}

function updatePlayerSteering(body, speed, forwardSpeed) {
  var steeringInput = 0;

  if (keyIsDown(LEFT_ARROW)) {
    steeringInput -= 1;
  }

  if (keyIsDown(RIGHT_ARROW)) {
    steeringInput += 1;
  }

  if (steeringInput !== 0) {
    var speedFactor = constrain(speed / 8, 0.25, 1);

    // Reversing flips the steering direction.
    if (forwardSpeed < -0.5) {
      steeringInput *= -1;
    }

    Matter.Body.setAngularVelocity(
      body,
      steeringInput * playerTurnRate * speedFactor
    );
  } else {
    Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.82);
  }
}

function limitPlayerSpeed() {
  if (playerCar === null) {
    return;
  }

  // The physics engine can stack boosts and impacts.
  var body = playerCar.body;
  var velocity = body.velocity;
  var speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

  if (speed < 0.01) {
    return;
  }

  var forward = {
    x: cos(body.angle),
    y: sin(body.angle)
  };

  var forwardSpeed = velocity.x * forward.x + velocity.y * forward.y;
  var speedLimit = playerMaxForwardSpeed;

  if (forwardSpeed < 0) {
    speedLimit = playerMaxReverseSpeed;
  }

  if (playerCar.boostUntil > frameCount) {
    speedLimit *= getBoostMultiplier();
  }

  if (speed > speedLimit) {
    Matter.Body.setVelocity(body, {
      x: velocity.x / speed * speedLimit,
      y: velocity.y / speed * speedLimit
    });
  }
}

// Car game object class.
class Car {
  constructor(x, y, angle, carType, bodyColor) {
    this.carType = carType;
    this.bodyColor = bodyColor;
    this.lastTurnFrame = -999;
    this.lastBoostFrame = -999;
    this.lastGateFrame = -999;
    this.lastShieldGateFrame = -999;
    this.lastNearMissFrame = -999;
    this.shieldUntil = -999;
    this.boostUntil = -999;
    this.trail = [];
    this.trailMaxLength = carType === "slow" ? 14 : 22;

    // Slow cars use heavier physics so their behaviour is visibly different.
    var carDensity = 0.0016;
    var airResistance = 0.025;

    if (carType === "slow") {
      carDensity = 0.0028;
      airResistance = 0.04;
    }

    var carSettings = {
      restitution: 0.72,
      friction: 0.18,
      frictionAir: airResistance,
      density: carDensity,
      label: carType + "-car"
    };

    this.body = Matter.Bodies.rectangle(x, y, 88, 46, carSettings);
    Matter.Body.setAngle(this.body, angle);
    Matter.World.add(world, this.body);
  }

  draw() {
    // All car details are drawn relative to the Matter body position and angle.
    var position = this.body.position;
    var isPlayer = this === playerCar;
    var boosted = this.boostUntil > frameCount;
    var bodyRed = red(this.bodyColor);
    var bodyGreen = green(this.bodyColor);
    var bodyBlue = blue(this.bodyColor);
    var glowSize = boosted ? 1.08 : 1;
    var beamLength = this.body.isStatic ? 28 : boosted ? 118 : 86;
    var beamAlpha = this.body.isStatic ? 34 : boosted ? 68 : 46;

    push();
    translate(position.x, position.y);
    rotate(this.body.angle);
    rectMode(CENTER);

    // Headlight beams.
    noStroke();
    fill(255, 236, 176, beamAlpha);
    quad(55, -12, 55 + beamLength, -12, 55 + beamLength, -6, 55, -6);
    quad(55, 12, 55 + beamLength, 12, 55 + beamLength, 6, 55, 6);

    fill(70, 156, 222, beamAlpha * 0.45);
    quad(58, -4, 58 + beamLength * 0.85, -4, 58 + beamLength * 0.85, 4, 58, 4);

    // The drawn car.
    noStroke();
    fill(0, 0, 0, 135);
    ellipse(8, 11, 112, 58);

    fill(bodyRed, bodyGreen, bodyBlue, boosted ? 135 : 75);
    ellipse(0, 0, 112 * glowSize, 58 * glowSize);

    fill(8, 8, 22);
    rect(-35, -29, 36, 8, 4);
    rect(-35, 29, 36, 8, 4);
    rect(27, -28, 31, 9, 4);
    rect(27, 28, 31, 9, 4);

    fill(12, 13, 30);
    rect(-48, 0, 14, 42, 5);
    rect(54, 0, 10, 28, 4);

    fill(bodyRed, bodyGreen, bodyBlue);
    beginShape();
    vertex(-50, -14);
    vertex(-34, -25);
    vertex(18, -24);
    vertex(45, -15);
    vertex(58, -6);
    vertex(58, 6);
    vertex(45, 15);
    vertex(18, 24);
    vertex(-34, 25);
    vertex(-50, 14);
    endShape(CLOSE);

    fill(255, 255, 255, 45);
    beginShape();
    vertex(-38, -17);
    vertex(4, -18);
    vertex(21, -10);
    vertex(0, -7);
    vertex(-32, -8);
    endShape(CLOSE);

    fill(12, 16, 28, 235);
    beginShape();
    vertex(-17, -15);
    vertex(16, -13);
    vertex(33, -5);
    vertex(34, 5);
    vertex(16, 13);
    vertex(-17, 15);
    vertex(-27, 0);
    endShape(CLOSE);

    fill(230, 238, 246, 230);
    ellipse(12, 0, 24, 14);

    fill(255, 255, 255, 160);
    ellipse(18, -3, 7, 4);

    stroke(255, 255, 255, 125);
    strokeWeight(2);
    line(-30, -20, 24, -20);
    line(-30, 20, 24, 20);

    noStroke();
    fill(255, 236, 176, 245);
    rect(53, -9, 12, 6, 3);
    rect(53, 9, 12, 6, 3);

    fill(255, 255, 255, 225);
    ellipse(58, -9, 5, 4);
    ellipse(58, 9, 5, 4);

    fill(0, 0, 0, 150);
    quad(19, -24, 39, -18, 30, -14, 13, -18);
    quad(19, 24, 39, 18, 30, 14, 13, 18);

    fill(239, 105, 86, 230);
    rect(-55, -13, 7, 9, 3);
    rect(-55, 13, 7, 9, 3);

    if (boosted) {
      fill(70, 156, 222, 170);
      triangle(-58, -14, -92, 0, -58, 14);
      fill(245, 178, 73, 145);
      triangle(-50, -8, -74, 0, -50, 8);
    }

    if (this.carType === "slow") {
      fill(245, 178, 73, 150);
      rect(-12, -22, 13, 5, 2);
      rect(-12, 22, 13, 5, 2);
      rect(14, -22, 13, 5, 2);
      rect(14, 22, 13, 5, 2);
    }

    if (isPlayer) {
      noFill();
      stroke(255, 255, 255, 200);
      strokeWeight(2);
      ellipse(0, 0, 108, 58);

      stroke(70, 156, 222, 150);
      strokeWeight(1);
      ellipse(0, 0, 120, 68);
    }

    if (isCarShielded(this)) {
      var shieldPulse = sin(frameCount * 0.12) * 6;

      noFill();
      stroke(112, 214, 164, 190);
      strokeWeight(3);
      ellipse(0, 0, 132 + shieldPulse, 80 + shieldPulse * 0.45);

      stroke(255, 255, 255, 90);
      strokeWeight(1);
      ellipse(0, 0, 148 + shieldPulse, 92 + shieldPulse * 0.5);
    }

    pop();
  }
}

function updateArenaView() {
  // The UI panel reserves screen space, then the arena scales into what remains.
  var panelSpace = width >= 950 ? uiPanelWidth + uiPanelMargin * 2 : 28;
  var rightSpace = 28;
  var topSpace = width >= 950 ? 96 : 122;
  var bottomSpace = 28;

  var availableWidth = width - panelSpace - rightSpace;
  var availableHeight = height - topSpace - bottomSpace;

  // The game world arena 1400 x 700.
  viewScale = min(availableWidth / arenaWidth, availableHeight / arenaHeight);
  viewScale = min(viewScale, 1);

  viewX = panelSpace + availableWidth / 2 - arenaWidth * viewScale / 2;
  viewY = topSpace + availableHeight / 2 - arenaHeight * viewScale / 2;
}

function drawBackgroundPattern() {
  // The page background.
  background(10, 14, 24);

  noStroke();
  fill(15, 11, 39, 185);
  rect(0, 0, width, height);

  stroke(66, 57, 120, 130);
  strokeWeight(1);

  for (var x = -200; x < width + 200; x += 90) {
    line(x, height, x + 360, 0);
  }

  stroke(239, 105, 86, 24);

  for (var y = 40; y < height; y += 96) {
    line(0, y, width, y - 22);
  }

  if (width >= 950) {
    stroke(70, 156, 222, 40);
    line(
      uiPanelWidth + uiPanelMargin * 2 - 12,
      0,
      uiPanelWidth + uiPanelMargin * 2 - 12,
      height
    );
  }
}

function drawArenaFloor() {
  noStroke();
  fill(16, 20, 34);
  rect(0, 0, arenaWidth, arenaHeight);

  fill(27, 18, 64, 155);
  rect(
    startZoneWidth,
    wallThickness,
    arenaWidth - startZoneWidth - wallThickness,
    arenaHeight - wallThickness * 2
  );

  fill(12, 51, 72, 100);
  rect(startZoneWidth, wallThickness, 190, arenaHeight - wallThickness * 2);

  // Curved light trails.
  noFill();
  strokeWeight(2);

  for (var i = 0; i < 4; i++) {
    var y = 150 + i * 125;
    stroke(70, 156, 222, 18);
    bezier(
      startZoneWidth + 70,
      y,
      startZoneWidth + 350,
      y - 42,
      arenaWidth - 430,
      y + 48,
      arenaWidth - wallThickness - 90,
      y - 12
    );
  }

  stroke(239, 105, 86, 18);

  for (var arcX = startZoneWidth + 180; arcX < arenaWidth - 180; arcX += 220) {
    arc(arcX, arenaHeight / 2, 160, 480, -0.82, 0.82);
  }

  noStroke();
  fill(245, 178, 73, 74);

  for (var dotX = startZoneWidth + 120; dotX < arenaWidth - 90; dotX += 170) {
    ellipse(dotX, wallThickness + 18, 34, 4);
    ellipse(dotX + 42, arenaHeight - wallThickness - 18, 34, 4);
  }
}

function drawArenaDecor() {
  // The reactor decoration also acts as a visual meter for overdrive charge.
  var centerX = arenaWidth * 0.61;
  var centerY = arenaHeight * 0.5;
  var chargeRatio = getReactorChargeRatio();
  var overdrive = isReactorOverdrive();
  var pulse = sin(frameCount * 0.035) * (overdrive ? 22 : 12) + reactorPulse;
  var ringAlpha = 22 + chargeRatio * 48 + (overdrive ? 45 : 0);

  noFill();
  strokeWeight(2);

  for (var r = 135; r <= 360; r += 55) {
    stroke(70, 156, 222, ringAlpha);
    ellipse(centerX, centerY, r + pulse, r * 0.5 + pulse * 0.25);
  }

  stroke(239, 105, 86, 60 + chargeRatio * 75);
  arc(centerX, centerY, 210, 88, frameCount * 0.014, frameCount * 0.014 + PI * 0.75);

  stroke(245, 178, 73, 55 + chargeRatio * 80);
  arc(centerX, centerY, 300, 132, -frameCount * 0.01, -frameCount * 0.01 + PI * 0.55);

  if (overdrive) {
    stroke(245, 178, 73, 145 + sin(frameCount * 0.18) * 55);
    strokeWeight(4);
    ellipse(centerX, centerY, 430 + pulse * 0.35, 196 + pulse * 0.18);
  }

  noStroke();
  fill(70, 156, 222, 35 + chargeRatio * 75);
  ellipse(centerX, centerY, 118, 22);
  fill(245, 178, 73, 55 + chargeRatio * 110);
  ellipse(centerX, centerY, 42, 42);

  if (overdrive) {
    fill(239, 105, 86, 120);
    ellipse(centerX, centerY - 36, 18, 32);
    ellipse(centerX, centerY + 36, 18, 32);
  }

  fill(239, 105, 86, 95);

  for (var i = 0; i < 7; i++) {
    var gateX = startZoneWidth + 270 + i * 135;
    triangle(gateX, 84, gateX + 28, 104, gateX, 124);
    triangle(
      gateX,
      arenaHeight - 84,
      gateX + 28,
      arenaHeight - 104,
      gateX,
      arenaHeight - 124
    );
  }
}

function drawScanBeams() {
  // Scan beams are decorative only, they do not affect car.
  var lightSpacing = 310;

  for (var i = 0; i < 4; i++) {
    var topX = startZoneWidth + 170 + i * lightSpacing;
    var bottomX = topX + sin(frameCount * 0.018 + i * 1.6) * 34;
    var lampColor = i % 2 === 0 ? color(70, 156, 222) : color(245, 178, 73);

    drawSoftSpotlight(
      topX,
      wallThickness + 42,
      bottomX,
      arenaHeight - wallThickness - 44,
      lampColor,
      i
    );

    noStroke();
    fill(239, 105, 86, 160);
    ellipse(topX, wallThickness + 34, 24, 18);

    fill(red(lampColor), green(lampColor), blue(lampColor), 145);
    ellipse(bottomX, arenaHeight - wallThickness - 34, 28, 18);
  }

  drawArenaSparkMarkers();
}

function drawSoftSpotlight(topX, topY, bottomX, bottomY, beamColor, index) {
  var sway = sin(frameCount * 0.025 + index) * 16;

  noStroke();

  for (var layer = 0; layer < 3; layer++) {
    var topWidth = 10 + layer * 8;
    var bottomWidth = 72 + layer * 32;
    var alpha = 20 - layer * 5;
    var midX = (topX + bottomX) / 2 + sway * (layer + 1) * 0.25;
    var midY = (topY + bottomY) / 2;

    fill(red(beamColor), green(beamColor), blue(beamColor), alpha);
    beginShape();
    curveVertex(topX - topWidth, topY);
    curveVertex(topX - topWidth, topY);
    curveVertex(midX - bottomWidth * 0.42, midY);
    curveVertex(bottomX - bottomWidth * 0.5, bottomY);
    curveVertex(bottomX + bottomWidth * 0.5, bottomY);
    curveVertex(midX + bottomWidth * 0.42, midY);
    curveVertex(topX + topWidth, topY);
    curveVertex(topX + topWidth, topY);
    endShape(CLOSE);
  }
}

function drawArenaSparkMarkers() {
  for (var i = 0; i < 14; i++) {
    var phase = frameCount * 0.012 + i * 1.7;
    var x = startZoneWidth + 115 + (i * 82) % (arenaWidth - startZoneWidth - 170);
    var y = wallThickness + 90 + (i * 97) % (arenaHeight - wallThickness * 2 - 180);
    var shimmer = sin(phase) * 14;

    noStroke();
    fill(239, 105, 86, 42);
    triangle(x + shimmer, y - 11, x + shimmer, y + 11, x + 20 + shimmer, y);

    fill(70, 156, 222, 28);
    ellipse(x - shimmer * 0.45, y + 34, 38, 5);
  }
}

function drawEnergyGates() {
  if (!isReactorOverdrive()) {
    return;
  }

  for (var i = 0; i < energyGates.length; i++) {
    drawEnergyGate(energyGates[i]);
  }
}

function drawEnergyGate(gate) {
  var pulse = sin(frameCount * 0.16 + gate.x * 0.01) * 8;

  push();
  translate(gate.x, gate.y);
  rotate(gate.angle);
  rectMode(CENTER);

  noStroke();
  fill(red(gate.color), green(gate.color), blue(gate.color), 38);
  ellipse(0, 0, gate.radius * 2 + pulse, gate.radius * 1.2 + pulse * 0.4);

  stroke(red(gate.color), green(gate.color), blue(gate.color), 190);
  strokeWeight(5);
  line(-gate.radius * 0.8, -gate.radius * 0.45, gate.radius * 0.8, -gate.radius * 0.45);
  line(-gate.radius * 0.8, gate.radius * 0.45, gate.radius * 0.8, gate.radius * 0.45);

  stroke(255, 255, 255, 150);
  strokeWeight(2);
  line(-24, 0, 24, 0);

  noStroke();
  fill(255, 255, 255, 180);
  triangle(20, -12, 44, 0, 20, 12);

  pop();
}

function drawGateBursts() {
  for (var i = 0; i < gateBursts.length; i++) {
    var burst = gateBursts[i];
    var progress = burst.age / burst.life;
    var alpha = map(progress, 0, 1, 210, 0);
    var distance = map(progress, 0, 1, 8, 105);

    push();
    translate(burst.x, burst.y);
    rotate(burst.angle);

    stroke(red(burst.color), green(burst.color), blue(burst.color), alpha);
    strokeWeight(5);
    line(-20, -16, distance, -16);
    line(-20, 16, distance, 16);

    noFill();
    stroke(255, 255, 255, alpha * 0.75);
    strokeWeight(2);
    ellipse(0, 0, 55 + distance * 0.3, 32 + distance * 0.15);

    pop();
  }
}

function drawShieldGate() {
  for (var i = 0; i < shieldGates.length; i++) {
    shieldGates[i].draw();
  }
}

function drawShieldBursts() {
  for (var i = 0; i < shieldBursts.length; i++) {
    var burst = shieldBursts[i];
    var progress = burst.age / burst.life;
    var alpha = map(progress, 0, 1, 210, 0);
    var radius = map(progress, 0, 1, 24, 120);

    noFill();
    stroke(red(burst.color), green(burst.color), blue(burst.color), alpha);
    strokeWeight(4);
    ellipse(burst.x, burst.y, radius * 2, radius * 1.25);

    stroke(255, 255, 255, alpha * 0.6);
    strokeWeight(1);
    ellipse(burst.x, burst.y, radius * 1.35, radius * 0.82);
  }
}

function updateBoostPads() {
  // Every moving car can use boost pads, including opponents.
  for (var i = 0; i < allCars.length; i++) {
    for (var j = 0; j < boostPads.length; j++) {
      if (isCarOnBoostPad(allCars[i], boostPads[j])) {
        triggerBoost(allCars[i], boostPads[j]);
      }
    }
  }
}

function isCarOnBoostPad(car, pad) {
  var body = car.body;

  return dist(body.position.x, body.position.y, pad.x, pad.y) < pad.radius;
}

function triggerBoost(car, pad) {
  if (frameCount - car.lastBoostFrame < boostCooldown) {
    return;
  }

  // The pad replaces the car's velocity so the launch direction.
  var body = car.body;
  var direction = {
    x: cos(pad.angle),
    y: sin(pad.angle)
  };

  var currentSpeed = sqrt(
    body.velocity.x * body.velocity.x +
    body.velocity.y * body.velocity.y
  );
  var boostedSpeed = constrain(currentSpeed * getBoostMultiplier() + 4, 8, 18);

  // Directional pads enter the reactor lane, get launched.
  Matter.Body.setAngle(body, pad.angle);
  Matter.Body.setVelocity(body, {
    x: direction.x * boostedSpeed,
    y: direction.y * boostedSpeed
  });

  car.pathHeading = pad.angle;
  car.lastBoostFrame = frameCount;
  car.boostUntil = frameCount + (isReactorOverdrive() ? 54 : 38);

  if (car === playerCar) {
    boostUseCount++;
    addPlayerScore(20, "BOOST +20", pad.x, pad.y - 34, color(245, 178, 73));
  }

  boostBursts.push({
    x: pad.x,
    y: pad.y,
    angle: pad.angle,
    color: pad.color,
    age: 0,
    life: 24
  });

  if (boostBursts.length > 12) {
    boostBursts.shift();
  }
}

function updateBoostBursts() {
  for (var i = boostBursts.length - 1; i >= 0; i--) {
    boostBursts[i].age++;

    if (boostBursts[i].age > boostBursts[i].life) {
      boostBursts.splice(i, 1);
    }
  }
}

function drawBoostPads() {
  for (var i = 0; i < boostPads.length; i++) {
    drawBoostPad(boostPads[i]);
  }
}

function drawBoostPad(pad) {
  var overdrive = isReactorOverdrive();
  var pulse = sin(
    frameCount * (overdrive ? 0.14 : 0.08) +
    pad.x * 0.01
  ) * (overdrive ? 13 : 8);
  var padScale = overdrive ? 1.14 : 1;
  var glowBoost = overdrive ? 70 : 0;

  push();
  translate(pad.x, pad.y);
  rotate(pad.angle);

  noStroke();
  fill(red(pad.color), green(pad.color), blue(pad.color), 30 + glowBoost * 0.35);
  ellipse(
    0,
    0,
    pad.radius * 2.25 * padScale + pulse,
    pad.radius * 1.05 * padScale + pulse * 0.3
  );

  stroke(red(pad.color), green(pad.color), blue(pad.color), 170 + glowBoost);
  strokeWeight(3);
  noFill();
  ellipse(0, 0, pad.radius * 1.8 * padScale, pad.radius * 0.78 * padScale);

  noStroke();
  fill(red(pad.color), green(pad.color), blue(pad.color), 160);
  triangle(-28, -20, -28, 20, 0, 0);
  triangle(4, -20, 4, 20, 34, 0);

  fill(255, 255, 255, 190);
  ellipse(-48, -7, 10, 8);
  ellipse(48, -7, 10, 8);
  ellipse(-48, 7, 10, 8);
  ellipse(48, 7, 10, 8);

  pop();
}

function drawBoostBursts() {
  for (var i = 0; i < boostBursts.length; i++) {
    var burst = boostBursts[i];
    var progress = burst.age / burst.life;
    var alpha = map(progress, 0, 1, 190, 0);
    var length = map(progress, 0, 1, 28, 120);

    push();
    translate(burst.x, burst.y);
    rotate(burst.angle);

    noFill();
    stroke(red(burst.color), green(burst.color), blue(burst.color), alpha);
    strokeWeight(5);
    ellipse(0, 0, 70 + length * 0.25, 42 + length * 0.12);

    stroke(255, 255, 255, alpha * 0.8);
    strokeWeight(3);
    line(-length * 0.35, -18, length, -18);
    line(-length * 0.35, 18, length, 18);

    pop();
  }
}

function drawStartZone() {
  // The Start Zone.
  noStroke();
  fill(10, 55, 76, 178);
  rect(0, 0, startZoneWidth, arenaHeight);

  fill(70, 156, 222, 14);
  rect(
    wallThickness,
    wallThickness,
    startZoneWidth - wallThickness - 12,
    arenaHeight - wallThickness * 2,
    4
  );

  stroke(70, 156, 222);
  strokeWeight(4);
  line(startZoneWidth, 0, startZoneWidth, arenaHeight);

  for (var i = 0; i < launchBayCount; i++) {
    var bayY = firstParkingY + i * parkingGap;
    drawLaunchParkingSlot(bayY, i);
  }

  drawLaunchBayHeader();
}

function drawLaunchParkingSlot(centerY, slotNumber) {
  // Each slot uses the same measurements so parked cars line up reliably.
  var slotX = parkingSpotX - parkingSpotWidth / 2;
  var slotY = centerY - parkingSpotHeight / 2;
  var playerBay = slotNumber === carNumbers;
  var labelText = playerBay ? "PLAYER BAY" : "BAY " + (slotNumber + 1);

  noStroke();
  fill(0, 0, 0, 88);
  rect(slotX + 6, slotY + 7, parkingSpotWidth, parkingSpotHeight, 10);

  fill(playerBay ? color(76, 44, 23, 125) : color(12, 21, 42, 118));
  rect(slotX, slotY, parkingSpotWidth, parkingSpotHeight, 10);

  stroke(playerBay ? color(245, 178, 73, 190) : color(70, 156, 222, 135));
  strokeWeight(2);
  noFill();
  rect(slotX, slotY, parkingSpotWidth, parkingSpotHeight, 10);

  stroke(playerBay ? color(245, 178, 73, 90) : color(70, 156, 222, 65));
  strokeWeight(2);
  line(slotX + 12, centerY, slotX + 34, centerY);
  line(slotX + parkingSpotWidth - 34, centerY, slotX + parkingSpotWidth - 12, centerY);

  stroke(playerBay ? color(245, 178, 73, 105) : color(70, 156, 222, 75));
  line(
    slotX + 12,
    slotY + parkingSpotHeight + 13,
    slotX + parkingSpotWidth - 12,
    slotY + parkingSpotHeight + 13
  );

  noStroke();
  fill(playerBay ? color(245, 178, 73, 230) : color(230, 238, 246, 175));
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(9);
  text(labelText, slotX + 10, slotY - 10);
  textStyle(NORMAL);
}

function drawLaunchBayHeader() {
  // The deploy label.
  var labelX = wallThickness + 16;
  var labelRight = startZoneWidth - 22;
  var deployY = firstParkingY + carNumbers * parkingGap + parkingSpotHeight / 2 + 24;
  var deployWidth = labelRight - labelX;

  noStroke();
  fill(230, 238, 246);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(13);
  text("LAUNCH BAY", labelX, wallThickness + 15);

  stroke(70, 156, 222, 115);
  strokeWeight(2);
  line(labelX, wallThickness + 29, labelRight, wallThickness + 29);

  fill(16, 20, 34, 185);
  stroke(245, 178, 73, 155);
  strokeWeight(1.5);
  rect(labelX, deployY - 11, deployWidth, 22, 5);

  noStroke();
  fill(245, 178, 73, 235);
  textAlign(CENTER, CENTER);
  textSize(10);
  text("I + CLICK TO DEPLOY", labelX + deployWidth / 2, deployY);
  textStyle(NORMAL);
}

function drawInsertionPreview() {
  if (!insertArmed || playerCar !== null) {
    return;
  }

  // The preview follows the mouse and turns green only where spawning is legal.
  var arenaPoint = screenToArena(mouseX, mouseY);
  var validPosition = isInsideStartZone(arenaPoint.x, arenaPoint.y) &&
                      isSpawnClear(arenaPoint.x, arenaPoint.y);

  drawArmedSpawnZones(validPosition);
  noFill();

  if (validPosition) {
    stroke(112, 214, 164);
  } else {
    stroke(239, 105, 86);
  }

  strokeWeight(3);
  ellipse(arenaPoint.x, arenaPoint.y, playerSpawnRadius * 2, playerSpawnRadius * 2);
}

function drawArmedSpawnZones(validPosition) {
  // While I is armed, each mode highlights the exact type of bay it accepts.
  if (currentMode === 1) {
    var playerBayY = firstParkingY + carNumbers * parkingGap;

    drawSingleSpawnGlow({
      x: parkingSpotX - parkingSpotWidth / 2,
      y: playerBayY - parkingSpotHeight / 2,
      w: parkingSpotWidth,
      h: parkingSpotHeight
    }, validPosition);

    return;
  }

  for (var i = 0; i < launchBayCount; i++) {
    var bayY = firstParkingY + i * parkingGap;

    drawSingleSpawnGlow({
      x: parkingSpotX - parkingSpotWidth / 2,
      y: bayY - parkingSpotHeight / 2,
      w: parkingSpotWidth,
      h: parkingSpotHeight
    }, validPosition);
  }
}

function drawSingleSpawnGlow(zone, validPosition) {
  var zoneColor = validPosition ? color(112, 214, 164) : color(239, 105, 86);
  var pulse = sin(frameCount * 0.12) * 5;

  noFill();
  stroke(red(zoneColor), green(zoneColor), blue(zoneColor), 145);
  strokeWeight(3);
  rect(zone.x - 3, zone.y - 3, zone.w + 6, zone.h + 6, 10);

  stroke(red(zoneColor), green(zoneColor), blue(zoneColor), 45);
  strokeWeight(7);
  rect(
    zone.x - pulse * 0.2,
    zone.y - pulse * 0.2,
    zone.w + pulse * 0.4,
    zone.h + pulse * 0.4,
    12
  );
}

function updateCarTrails() {
  if (frameCount % trailSampleRate !== 0) {
    return;
  }

  // Trails are sampled every few frames.
  for (var i = 0; i < allCars.length; i++) {
    var car = allCars[i];
    var body = car.body;
    var speed = sqrt(
      body.velocity.x * body.velocity.x +
      body.velocity.y * body.velocity.y
    );

    // Very slow cars skip trail samples to avoid cluttering parked areas.
    if (speed > 0.35) {
      car.trail.push({
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
        alpha: constrain(speed * 22, 30, 150)
      });
    }

    while (car.trail.length > car.trailMaxLength) {
      car.trail.shift();
    }
  }
}

function drawAllCarTrails() {
  for (var i = 0; i < allCars.length; i++) {
    drawCarTrail(allCars[i]);
  }
}

function drawCarTrail(car) {
  var advancedOpponentTrail = isAdvancedOpponentTrail(car);

  noStroke();

  for (var i = 0; i < car.trail.length; i++) {
    var point = car.trail[i];
    var fade = map(i, 0, car.trail.length - 1, 0.15, 1);
    var trailWidth = map(i, 0, car.trail.length - 1, 18, 42);
    var trailAlpha = point.alpha * fade;

    if (isReactorOverdrive()) {
      trailAlpha *= 1.45;
    }

    push();
    translate(point.x, point.y);
    rotate(point.angle);

    // The trail is drawn under the car.
    rectMode(CENTER);

    if (advancedOpponentTrail) {
      drawAdvancedOpponentTrail(car, i, trailWidth, trailAlpha);
    } else {
      fill(red(car.bodyColor), green(car.bodyColor), blue(car.bodyColor), trailAlpha);
      rect(-26, 0, trailWidth, 24, 8);
    }

    pop();
  }
}

function isAdvancedOpponentTrail(car) {
  return currentMode === 3 && car !== playerCar && getOpponentFromBody(car.body) !== null;
}

function drawAdvancedOpponentTrail(car, trailIndex, trailWidth, trailAlpha) {
  var waveOffset = sin(trailIndex * 0.9 + frameCount * 0.08) * 8;
  var bodyRed = red(car.bodyColor);
  var bodyGreen = green(car.bodyColor);
  var bodyBlue = blue(car.bodyColor);

  noStroke();
  fill(bodyRed, bodyGreen, bodyBlue, trailAlpha * 0.55);
  ellipse(-28, waveOffset, trailWidth * 1.25, 22);

  stroke(245, 178, 73, trailAlpha * 0.45);
  strokeWeight(2);
  line(-trailWidth * 0.75, waveOffset, trailWidth * 0.18, -waveOffset);

  noStroke();
  fill(70, 156, 222, trailAlpha * 0.25);
  ellipse(-18, -waveOffset * 0.5, trailWidth * 0.72, 14);
}

function drawAllCars() {
  for (var i = 0; i < allCars.length; i++) {
    allCars[i].draw();
  }
}

function drawArenaWalls() {
  var overdriveGlow = isReactorOverdrive() ? 1 : 0;
  var crowdFlashRatio = crowdFlashTimer / crowdFlashDuration;
  var crowdFlashAlpha = crowdFlashRatio * (70 + crowdFlashStrength * 18);

  noFill();

  stroke(239, 105, 86, 70 + overdriveGlow * 70);
  strokeWeight(wallThickness + 20);
  rect(0, 0, arenaWidth, arenaHeight);

  stroke(12, 16, 28);
  strokeWeight(wallThickness);
  rect(0, 0, arenaWidth, arenaHeight);

  stroke(70, 156, 222, 170 + overdriveGlow * 55);
  strokeWeight(5 + overdriveGlow * 2);
  rect(
    wallThickness / 2,
    wallThickness / 2,
    arenaWidth - wallThickness,
    arenaHeight - wallThickness
  );

  if (crowdFlashTimer > 0) {
    stroke(245, 178, 73, crowdFlashAlpha);
    strokeWeight(9 + crowdFlashStrength);
    rect(
      wallThickness / 2,
      wallThickness / 2,
      arenaWidth - wallThickness,
      arenaHeight - wallThickness
    );

    stroke(239, 105, 86, crowdFlashAlpha * 0.65);
    strokeWeight(3);
    line(wallThickness, wallThickness, arenaWidth - wallThickness, wallThickness);
  line(
    wallThickness,
    arenaHeight - wallThickness,
    arenaWidth - wallThickness,
    arenaHeight - wallThickness
  );
  }

  stroke(245, 178, 73, 155 + overdriveGlow * 55);
  strokeWeight(4);
  line(24, 24, 150, 24);
  line(24, 24, 24, 150);
  line(arenaWidth - 24, 24, arenaWidth - 150, 24);
  line(arenaWidth - 24, 24, arenaWidth - 24, 150);
  line(24, arenaHeight - 24, 150, arenaHeight - 24);
  line(24, arenaHeight - 24, 24, arenaHeight - 150);
  line(arenaWidth - 24, arenaHeight - 24, arenaWidth - 150, arenaHeight - 24);
  line(arenaWidth - 24, arenaHeight - 24, arenaWidth - 24, arenaHeight - 150);
}

function drawArenaRunHud() {
  if (width < 950) {
    return;
  }

  // The run HUD.
  var hudWidth = 350;
  var hudHeight = 60;
  var hudX = viewX - 8;
  var hudY = max(14, viewY - hudHeight - 26);
  var timerRatio = constrain(roundTimer / roundDuration, 0, 1);

  rectMode(CORNER);
  noStroke();
  fill(16, 20, 34, 218);
  rect(hudX, hudY, hudWidth, hudHeight, 7);

  stroke(245, 178, 73, 165);
  strokeWeight(2);
  noFill();
  rect(hudX, hudY, hudWidth, hudHeight, 7);

  noStroke();
  fill(245, 178, 73);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(11);
  text("RUN HUD", hudX + 14, hudY + 8);

  fill(230, 238, 246);
  textSize(20);
  text("Score " + gameScore, hudX + 14, hudY + 23);

  textAlign(RIGHT, TOP);
  fill(70, 156, 222);
  textSize(15);
  text(getRoundTimeText(), hudX + hudWidth - 14, hudY + 26);

  fill(18, 16, 46);
  rect(hudX + 14, hudY + 47, hudWidth - 28, 6, 4);

  fill(239, 105, 86, 220);
  rect(hudX + 14, hudY + 47, (hudWidth - 28) * timerRatio, 6, 4);

  fill(190);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  textSize(10);
  text("Best " + bestScore + "  |  " + getComboStatusText(), hudX + 132, hudY + 9);

  var objectiveX = hudX + hudWidth + 16;
  var objectiveW = min(430, viewX + arenaWidth * viewScale - objectiveX - 14);

  if (objectiveW > 260) {
    drawModeObjectiveBar(objectiveX, hudY, objectiveW);
  }
}

function drawModeObjectiveBar(x, y, w) {
  fill(16, 20, 34, 205);
  stroke(70, 156, 222, 135);
  strokeWeight(1.5);
  rect(x, y, w, 60, 7);

  noStroke();
  fill(245, 178, 73);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(10);
  text("MODE OBJECTIVE", x + 14, y + 15);

  fill(230, 238, 246, 225);
  textStyle(NORMAL);
  textSize(10);
  text(getModeObjectiveText(), x + 14, y + 36);
}

function getModeObjectiveText() {
  // The objective line keeps the different mode rules visible during gameplay.
  if (currentMode === 1) {
    return "Practice: insert only inside PLAYER bay";
  }

  if (currentMode === 2) {
    return "Random: launch anywhere inside Start Zone";
  }

  return "Advanced: launch anywhere and dodge wave rivals";
}

function getModeLabel() {
  if (currentMode === 1) {
    return "Mode 1: Practice";
  }

  if (currentMode === 2) {
    return "Mode 2: Random Opponents";
  }

  if (currentMode === 3) {
    return "Mode 3: Advanced Opponents";
  }

  return "Dodgem Arena";
}

function showModeBanner(modeNumber) {
  if (modeNumber === 1) {
    modeBannerText = "PRACTICE MODE";
    modeBannerSubtext = "Parked rivals. Learn the launch bay.";
  }

  if (modeNumber === 2) {
    modeBannerText = "RANDOM OPPONENTS";
    modeBannerSubtext = "Straight-line traffic with random starts.";
  }

  if (modeNumber === 3) {
    modeBannerText = "ADVANCED TRAJECTORIES";
    modeBannerSubtext = "Wave-pattern rivals are active.";
  }

  modeBannerTimer = modeBannerDuration;
}

function updateModeBanner() {
  if (modeBannerTimer > 0) {
    modeBannerTimer--;
  }
}

function drawModeBanner() {
  if (modeBannerTimer <= 0) {
    return;
  }

  var cardWidth = min(440, width - 48);
  var cardHeight = 64;
  var cardX = width / 2 - cardWidth / 2;
  var cardY = max(16, viewY - cardHeight - 18);
  var fadeAlpha = modeBannerTimer < 18 ? map(modeBannerTimer, 0, 18, 0, 235) : 235;

  noStroke();
  fill(16, 20, 34, fadeAlpha);
  rect(cardX, cardY, cardWidth, cardHeight, 8);

  stroke(70, 156, 222, fadeAlpha * 0.75);
  strokeWeight(2);
  noFill();
  rect(cardX, cardY, cardWidth, cardHeight, 8);

  noStroke();
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  fill(245, 178, 73, fadeAlpha);
  textSize(16);
  text(modeBannerText, cardX + cardWidth / 2, cardY + 13);

  textStyle(NORMAL);
  fill(230, 238, 246, fadeAlpha * 0.86);
  textSize(12);
  text(modeBannerSubtext, cardX + cardWidth / 2, cardY + 39);
}

function drawInterfaceText() {
  if (width < 950) {
    drawCompactHud();
    return;
  }

  drawControlPanel(
    uiPanelMargin,
    uiPanelMargin,
    uiPanelWidth,
    height - uiPanelMargin * 2
  );
}

function drawControlPanel(x, y, panelWidth, panelHeight) {
  // Panel spacing changes slightly on shorter screens to keep controls inside the box.
  var innerX = x + 16;
  var innerW = panelWidth - 32;
  var compactPanel = panelHeight < 760;
  var showTelemetry = panelHeight >= 805;
  var statusY = y + (compactPanel ? 76 : 82);
  var modeY = statusY + (compactPanel ? 128 : 132);
  var controlsY = modeY + (compactPanel ? 158 : 164);

  noStroke();
  fill(16, 20, 34, 235);
  rect(x, y, panelWidth, panelHeight, 8);

  stroke(70, 156, 222, 145);
  strokeWeight(2);
  rect(x, y, panelWidth, panelHeight, 8);

  drawPanelHeader(x, y, panelWidth);
  // Each panel section is drawn from measured offsets to avoid text overlap.
  drawStatusPanel(innerX, statusY, innerW);
  drawModePanel(innerX, modeY, innerW);
  drawControlsPanel(innerX, controlsY, innerW);

  if (showTelemetry) {
    drawTelemetryPanel(innerX, controlsY + 196, innerW);
  }
}

function drawPanelHeader(x, y, panelWidth) {
  noStroke();
  fill(239, 105, 86);
  rect(x, y, panelWidth, 8, 8, 8, 0, 0);

  fill(235);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(22);
  text("DODGEM", x + 18, y + 24);

  fill(70, 156, 222);
  textSize(17);
  text("REACTOR ARENA", x + 18, y + 52);
}

function drawStatusPanel(x, y, w) {
  // Status text changes with insertion, boost, shield, and timer state.
  drawPanelLabel("STATUS", x, y);

  var statusColor = getStatusColor();
  fill(red(statusColor), green(statusColor), blue(statusColor), 35);
  stroke(statusColor);
  strokeWeight(2);
  rect(x, y + 22, w, 92, 6);

  noStroke();
  fill(235);
  textAlign(LEFT, TOP);
  textSize(14);
  text(getPlayerStateText(), x + 12, y + 35);

  fill(175);
  textSize(10);
  text(getShieldHudText(), x + 12, y + 56);

  fill(245, 178, 73, 210);
  text(getReactorPercentText(), x + 12, y + 72);

  fill(230, 238, 246, 225);
  textStyle(BOLD);
  text("Score " + gameScore + "  |  Time " + getRoundTimeText(), x + 12, y + 90);
  textStyle(NORMAL);
}

function drawModePanel(x, y, w) {
  drawPanelLabel("MODES", x, y);

  drawModeButton(x, y + 24, w, 1, "PRACTICE", "parked cars");
  drawModeButton(x, y + 68, w, 2, "RANDOM", "straight paths");
  drawModeButton(x, y + 112, w, 3, "ADVANCED", "sine-wave rivals");
}

function drawModeButton(x, y, w, modeNumber, title, detail) {
  var active = currentMode === modeNumber;

  // The active mode is highlighted so the player can read it at a glance.
  if (active) {
    fill(70, 156, 222, 42);
    stroke(70, 156, 222);
  } else {
    fill(22, 27, 43, 210);
    stroke(79, 86, 142);
  }

  strokeWeight(2);
  rect(x, y, w, 35, 6);

  noStroke();
  fill(active ? color(245, 178, 73) : color(205));
  textStyle(BOLD);
  textSize(16);
  text(modeNumber, x + 13, y + 8);

  fill(235);
  textSize(13);
  text(title, x + 42, y + 6);

  textStyle(NORMAL);
  fill(160);
  textSize(11);
  text(detail, x + 42, y + 21);
}

function drawControlsPanel(x, y, w) {
  var firstRowY = 20;
  var rowGap = 24;

  drawPanelLabel("CONTROLS", x, y);

  drawControlLine("I", "insert player", x, y + firstRowY, w);
  drawControlLine("CLICK", "place in Launch Bay", x, y + firstRowY + rowGap, w);
  drawControlLine("ARROWS", "drive and steer", x, y + firstRowY + rowGap * 2, w);
  drawControlLine("1 2 3", "change mode", x, y + firstRowY + rowGap * 3, w);
  drawControlLine("M", "mute music", x, y + firstRowY + rowGap * 4, w);
}

function drawControlLine(keyName, description, x, y, w) {
  fill(22, 27, 43, 220);
  stroke(79, 86, 142);
  strokeWeight(1);
  rect(x, y, w, 21, 5);

  noStroke();
  fill(245, 178, 73);
  textStyle(BOLD);
  textSize(11);
  textAlign(LEFT, TOP);
  text(keyName, x + 9, y + 4);

  textStyle(NORMAL);
  fill(215);
  text(description, x + 70, y + 4);
}

function drawTelemetryPanel(x, y, w) {
  drawPanelLabel("LIVE READOUT", x, y);

  drawMetricRow("Player", getPlayerNameText(), x, y + 28, w);
  drawMetricRow("Shield", getShieldStateLabel(), x, y + 58, w);
  drawMetricRow("Reactor", getReactorStateLabel(), x, y + 88, w);

  drawPanelBar("Speed", getPlayerSpeedRatio(), x, y + 130, w, color(70, 156, 222));
  drawPanelBar("Reactor", getReactorChargeRatio(), x, y + 174, w, getReactorBarColor());
}

function drawMetricRow(label, value, x, y, w) {
  fill(22, 27, 43, 185);
  noStroke();
  rect(x, y, w, 26, 5);

  fill(150);
  textAlign(LEFT, TOP);
  textSize(11);
  text(label, x + 10, y + 7);

  fill(235);
  textAlign(RIGHT, TOP);
  text(value, x + w - 10, y + 7);
}

function drawPanelBar(label, amount, x, y, w, barColor) {
  fill(160);
  textAlign(LEFT, TOP);
  textSize(11);
  text(label, x, y);

  fill(18, 16, 46);
  noStroke();
  rect(x, y + 18, w, 16, 5);

  fill(red(barColor), green(barColor), blue(barColor), 210);
  rect(x, y + 18, w * constrain(amount, 0, 1), 16, 5);
}

function drawPanelLabel(label, x, y) {
  noStroke();
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  fill(245, 178, 73);
  textSize(12);
  text(label, x, y);
  textStyle(NORMAL);
}

function drawCompactHud() {
  noStroke();
  fill(16, 20, 34, 225);
  rect(14, 14, width - 28, 94, 8);

  fill(235);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(16);
  text("Dodgem Reactor Arena", 28, 26);

  textStyle(NORMAL);
  fill(190);
  textSize(12);
  text(
    getModeLabel() + "  |  " + getReactorStateLabel() + "  |  Arrow keys drive",
    28,
    52
  );

  fill(245, 178, 73);
  text(
    "Score " + gameScore + "  |  Time " + getRoundTimeText() + "  |  " +
    getComboStatusText(),
    28,
    74
  );
}

function drawRoundResultOverlay() {
  if (!roundFinished) {
    return;
  }

  var cardWidth = min(420, width - 48);
  var cardHeight = 236;
  var cardX = (width - cardWidth) / 2;
  var cardY = (height - cardHeight) / 2;

  noStroke();
  fill(0, 0, 0, 135);
  rect(0, 0, width, height);

  fill(16, 20, 34, 245);
  rect(cardX, cardY, cardWidth, cardHeight, 10);

  stroke(245, 178, 73, 210);
  strokeWeight(2);
  noFill();
  rect(cardX, cardY, cardWidth, cardHeight, 10);

  noStroke();
  fill(245, 178, 73);
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  textSize(15);
  text("ROUND COMPLETE", cardX + cardWidth / 2, cardY + 24);

  fill(230, 238, 246);
  textSize(36);
  text(gameScore, cardX + cardWidth / 2, cardY + 56);

  fill(70, 156, 222);
  textSize(14);
  text(getRunGrade(), cardX + cardWidth / 2, cardY + 103);

  textStyle(NORMAL);
  fill(210);
  textSize(12);
  text(
    "Near misses: " + nearMissCount +
    "    Boosts: " + boostUseCount +
    "    Shields: " + shieldPickupCount,
    cardX + cardWidth / 2,
    cardY + 136
  );
  text(
    "Crashes: " + collisionCount + "    Best: " + bestScore,
    cardX + cardWidth / 2,
    cardY + 158
  );

  fill(239, 105, 86);
  textStyle(BOLD);
  text("Press 1, 2, or 3 to start another run", cardX + cardWidth / 2, cardY + 194);
  textStyle(NORMAL);
}

function getRoundTimeText() {
  if (!roundActive && !roundFinished && playerCar === null) {
    return "30s ready";
  }

  return ceil(roundTimer / 60) + "s";
}

function getComboStatusText() {
  if (comboCount > 1 && comboTimer > 0) {
    return "Combo x" + comboCount;
  }

  if (roundFinished) {
    return getRunGrade();
  }

  return "Near misses " + nearMissCount;
}

function getRunGrade() {
  if (gameScore >= 1600) {
    return "Arena Master";
  }

  if (gameScore >= 1000) {
    return "Reactor Driver";
  }

  if (gameScore >= 550) {
    return "Clean Dodger";
  }

  return "Rookie Run";
}

function getPlayerStateText() {
  if (playerCar === null && insertArmed) {
    if (currentMode === 1) {
      return "Click inside PLAYER bay";
    }

    return "Click inside Launch Bay";
  }

  if (playerCar === null) {
    return "Press I to insert player";
  }

  if (playerCar.boostUntil > frameCount) {
    return "Boost surge active";
  }

  return "Player car online";
}

function getStatusColor() {
  if (playerCar === null && insertArmed) {
    return color(245, 178, 73);
  }

  if (playerCar === null) {
    return color(239, 105, 86);
  }

  return color(70, 156, 222);
}

function getReactorChargeRatio() {
  if (reactorState === "charging") {
    return constrain(reactorCharge / reactorMaxCharge, 0, 1);
  }

  if (reactorState === "overdrive") {
    return constrain(reactorTimer / reactorOverdriveTime, 0, 1);
  }

  return constrain(reactorTimer / reactorCooldownTime, 0, 1);
}

function getReactorStateLabel() {
  if (reactorState === "overdrive") {
    return "overdrive";
  }

  if (reactorState === "cooling") {
    return "cooling";
  }

  return floor(getReactorChargeRatio() * 100) + "% charged";
}

function getReactorPercentText() {
  if (reactorState === "overdrive") {
    return "Overdrive: " + ceil(reactorTimer / 60) + "s active";
  }

  if (reactorState === "cooling") {
    return "Overdrive cooling: " + ceil(reactorTimer / 60) + "s";
  }

  return "Overdrive charge: " + floor(getReactorChargeRatio() * 100) + "%";
}

function getReactorBarColor() {
  if (reactorState === "overdrive") {
    return color(245, 178, 73);
  }

  if (reactorState === "cooling") {
    return color(239, 105, 86);
  }

  return color(70, 156, 222);
}

function getPlayerNameText() {
  if (playerCar === null) {
    return "not inserted";
  }

  return "azure runner";
}

function getShieldStateLabel() {
  if (playerCar !== null && isCarShielded(playerCar)) {
    return ceil((playerCar.shieldUntil - frameCount) / 60) + "s active";
  }

  if (shieldGates.length > 0) {
    return shieldGates.length + " gates open";
  }

  return "gate in " + ceil(shieldGateTimer / 60) + "s";
}

function getShieldHudText() {
  if (playerCar !== null && isCarShielded(playerCar)) {
    return "Shield: " + ceil((playerCar.shieldUntil - frameCount) / 60) + "s active";
  }

  if (shieldGates.length > 0) {
    return "Shield gates open: " + ceil(shieldGates[0].life / 60) + "s";
  }

  return "Shield gate spawns in " + ceil(shieldGateTimer / 60) + "s";
}

function getPlayerSpeedRatio() {
  if (playerCar === null) {
    return 0;
  }

  var velocity = playerCar.body.velocity;
  var speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

  return speed / (playerMaxForwardSpeed * getBoostMultiplier());
}

function startArenaMusic() {
  if (!musicReady || arenaMusic === null || musicStarted || musicMuted) {
    return;
  }

  if (typeof userStartAudio === "function") {
    // Browsers only allow audio after a user action, so this is called from
    // click/key input.
    userStartAudio();
  }

  arenaMusic.setLoop(true);
  arenaMusic.setVolume(getArenaMusicTargetVolume());
  arenaMusic.play();
  musicStarted = true;
  musicCurrentVolume = getArenaMusicTargetVolume();
}

function toggleArenaMusic() {
  if (!musicReady || arenaMusic === null) {
    return;
  }

  if (!musicStarted) {
    musicMuted = false;
    startArenaMusic();
    return;
  }

  musicMuted = !musicMuted;
  musicCurrentVolume = -1;
  updateArenaMusic();
}

function updateArenaMusic() {
  if (!musicReady || arenaMusic === null || !musicStarted) {
    return;
  }

  // Volume changes smoothly when overdrive or mute state changes.
  var targetVolume = musicMuted ? 0 : getArenaMusicTargetVolume();

  if (abs(targetVolume - musicCurrentVolume) > 0.01) {
    arenaMusic.setVolume(targetVolume, 0.2);
    musicCurrentVolume = targetVolume;
  }
}

function getArenaMusicTargetVolume() {
  if (reactorState === "overdrive") {
    return musicOverdriveVolume;
  }

  return musicBaseVolume;
}

function mousePressed() {
  startArenaMusic();

  if (!insertArmed || playerCar !== null) {
    return;
  }

  var arenaPoint = screenToArena(mouseX, mouseY);

  // The click creates the player only after both the mode rule and overlap rule pass.
  // This is why pressing I alone does not immediately spawn a car.
  if (isInsideStartZone(arenaPoint.x, arenaPoint.y) &&
      isSpawnClear(arenaPoint.x, arenaPoint.y)) {
    playerCar = new Car(arenaPoint.x, arenaPoint.y, 0, "standard", color(70, 156, 222));
    allCars.push(playerCar);
    insertArmed = false;
    startRunTimer();
  }
}

function keyPressed() {
  if (key === "m" || key === "M") {
    toggleArenaMusic();
    return;
  }

  // Any key press is also a valid browser gesture for starting audio.
  startArenaMusic();

  // The brief uses I to arm insertion, the click chooses the exact bay position.
  if (key === "i" || key === "I") {
    insertArmed = true;
  }

  if (key === "1") {
    loadMode(1);
  }

  if (key === "2") {
    loadMode(2);
  }

  if (key === "3") {
    loadMode(3);
  }
}

function screenToArena(screenX, screenY) {
  // Mouse input.
  return {
    x: (screenX - viewX) / viewScale,
    y: (screenY - viewY) / viewScale
  };
}

function isInsideStartZone(x, y) {
  // Mode 1 is stricter because the brief asks for insertion in the player bay.
  var carClearanceX = 62;
  var carClearanceY = 46;
  var playerBayY = firstParkingY + carNumbers * parkingGap;

  var insideArena = x > wallThickness + carClearanceX &&
                    x < arenaWidth - wallThickness &&
                    y > wallThickness + carClearanceY &&
                    y < arenaHeight - wallThickness - carClearanceY;

  var insideStartZone = x < startZoneWidth - carClearanceX;
  var insidePlayerBay = x > parkingSpotX - parkingSpotWidth / 2 &&
                        x < parkingSpotX + parkingSpotWidth / 2 &&
                        y > playerBayY - parkingSpotHeight / 2 &&
                        y < playerBayY + parkingSpotHeight / 2;

  if (currentMode === 1) {
    return insideArena && insideStartZone && insidePlayerBay;
  }

  // In Modes 2 and 3 the brief allows the player to start anywhere in the launch bay.
  return insideArena && insideStartZone;
}

function isSpawnClear(x, y) {
  // Player insertion is blocked if it would overlap any existing car.
  for (var i = 0; i < allCars.length; i++) {
    var carPosition = allCars[i].body.position;
    var distanceToCar = dist(x, y, carPosition.x, carPosition.y);

    if (distanceToCar < playerSpawnRadius * 2) {
      return false;
    }
  }

  return true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
