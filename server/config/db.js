// server/config/db.js
// Sequelize ORM connected to SQLite (zero-infra, swap to PostgreSQL by changing dialect + connection)

const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './veyano.db';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, '..', dbPath),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
  },
});

module.exports = sequelize;
