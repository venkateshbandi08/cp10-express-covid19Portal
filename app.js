const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "THE_SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API - 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "THE_SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertSnakeToCamelAPI2 = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertSnakeToCamelAPI5 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// API - 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
        SELECT * FROM state
        ORDER BY state_id;
    `;
  const statesArray = await db.all(getAllStatesQuery);
  response.send(
    statesArray.map((eachState) => convertSnakeToCamelAPI2(eachState))
  );
});

// API - 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getEachStateQuery = `
        SELECT * FROM state
        WHERE state_id = ${stateId};
    `;
  const eachStateArray = await db.get(getEachStateQuery);
  response.send(convertSnakeToCamelAPI2(eachStateArray));
});

// API - 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictDetailsQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );
  `;
  await db.run(postDistrictDetailsQuery);
  response.send("District Successfully Added");
});

// API - 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getEachDistrictQuery = `
        SELECT * FROM district
        WHERE district_id = ${districtId};
    `;
    const eachDistrictArray = await db.get(getEachDistrictQuery);
    response.send(convertSnakeToCamelAPI5(eachDistrictArray));
  }
);

// API - 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API - 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putDistrictDetailsQuery = `
        UPDATE district
        SET 
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
        WHERE district_id = ${districtId};
    `;
    await db.run(putDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

// API - 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT SUM(district.cases) AS totalCases,
        SUM(district.cured) AS totalCured,
        SUM(district.active) AS totalActive,
        SUM(district.deaths) AS totalDeaths
        FROM district NATURAL JOIN state
        WHERE district.state_id = ${stateId};
    `;
    const getAllStats = await db.get(getStateStatsQuery);
    response.send(getAllStats);
  }
);

module.exports = app;
