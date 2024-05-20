// Detta är en modul som samlar all databaskommunikation.

//Paketet mysql är installerat med "npm install mysql2"
//const mysql = require("mysql2/promise"); // "mysql2/promise" gör att vi kan använda async/await istället för callbacks.
//import { createConnection } from "mysql2";
import mysql from "mysql2/promise";

const tableName = "leaderboard";

// Här skapas ett databaskopplings-objekt med inställningar för att ansluta till servern och databasen.
async function getConnection() {
  return mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "agario",
  });
}

//const connection = await getConnection();

// Den här funktionen ska göra ett anrop till databasen för att hämta alla users.
export async function getUserData(name, password) {
  console.log("Hämtar användare i modul...");

  const connection = await getConnection();
  const result = await connection.execute(
    `SELECT * FROM ${tableName} where name = '${name}' AND password = '${password}'`
  );
  console.log(result);

  //console.log("resultatet från databasen", result)

  await connection.end(); //Stänger kopplingen till databasen.
  return result[0][0]; //Plats 0 innehåller alla rader som returnerats från databasen.
}

export async function userExists(name, password) {
  const connection = await getConnection();
  const result = await connection.execute(
    `SELECT * FROM ${tableName} where name = '${name}' AND password = '${password}'`
  );

  await connection.end(); //Stänger kopplingen till databasen.
  return result[0].length !== 0;
}

export async function addUser(name, password) {
  const connection = await getConnection();
  try {
    const result = await connection.query(
      `INSERT ${tableName} (name, password, score) VALUES ('${name}', '${password}', '0')`
    );
    return result[0];
  } catch (error) {
    return error.code;
  } finally {
    await connection.end();
  }
}

export async function updateUserScore(name, password, newScore) {
  const connection = await getConnection();
  const result = await connection.query(
    `UPDATE ${tableName} set (name, password, score) VALUES ('${name}', '${password}', '${score}')`
  );
  await connection.end();
  return result[0];
}

//getUserData("lolster6", "lol123");

// Detta exporterar delar av modulen så att andra filer kan komma åt dem med require.
/*module.exports = {
  userExists,
  getUserData,
  addUser,
};*/
