/* eslint-disable quotes */
const knex = require("knex");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const helpers = require("./test-helpers");

describe("Users Endpoints", function() {
  let db;

  const testUsers = helpers.makeUsersArray();
  const testUser = testUsers[0];

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("clean tables", () => helpers.cleanTables(db));

  afterEach("clean tables", () => helpers.cleanTables(db));

  describe(`POST /api/users`, () => {
    context(`User Validation`, () => {
      beforeEach("insert users", () => helpers.seedUsers(db, testUsers));

      const requiredFields = [
        "first_name",
        "user_name",
        "user_email",
        "password"
      ];

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "test@gmail.com",
          password: "test password"
        };

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field];

          return supertest(app)
            .post("/api/users")
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`
            });
        });
      });

      it(`responds 400 'Password must be longer than 8 characters' when empty password`, () => {
        const userShortPassword = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: "1234567"
        };
        return supertest(app)
          .post("/api/users")
          .send(userShortPassword)
          .expect(400, { error: `Password must be longer than 8 characters` });
      });

      it(`responds 400 'Password must be less than 72 characters' when long password`, () => {
        const userLongPassword = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: "*".repeat(73)
        };
        return supertest(app)
          .post("/api/users")
          .send(userLongPassword)
          .expect(400, { error: `Password must be less than 72 characters` });
      });

      it(`responds 400 error when password starts with spaces`, () => {
        const userPasswordStartsSpaces = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: " 1Aa!2Bb@"
        };
        return supertest(app)
          .post("/api/users")
          .send(userPasswordStartsSpaces)
          .expect(400, {
            error: `Password must not start or end with empty spaces`
          });
      });

      it(`responds 400 error when password ends with spaces`, () => {
        const userPasswordEndsSpaces = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: "1Aa!2Bb@ "
        };
        return supertest(app)
          .post("/api/users")
          .send(userPasswordEndsSpaces)
          .expect(400, {
            error: `Password must not start or end with empty spaces`
          });
      });

      it(`responds 400 error when password isn't complex enough`, () => {
        const userPasswordNotComplex = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: "11AAaabb"
        };
        return supertest(app)
          .post("/api/users")
          .send(userPasswordNotComplex)
          .expect(400, {
            error: `Password must contain 1 upper case, lower case, number and special character`
          });
      });

      it(`responds 400 'User name already taken' when user_name isn't unique`, () => {
        const duplicateUser = {
          first_name: "test first_name",
          user_name: testUser.user_name,
          user_email: "testuser@gmail.com",
          password: "11AAaa!!"
        };
        return supertest(app)
          .post("/api/users")
          .send(duplicateUser)
          .expect(400, { error: `Username already taken` });
      });
    });
    context(`Happy path`, () => {
      it(`responds 201, serialized user, storing bcrypted password`, () => {
        const newUser = {
          first_name: "test first_name",
          user_name: "test user_name",
          user_email: "testuser@gmail.com",
          password: "11AAaa!!"
        };
        return supertest(app)
          .post("/api/users")
          .send(newUser)
          .expect(201)
          .expect(res => {
            expect(res.body).to.have.property("id");
            expect(res.body.first_name).to.eql(newUser.first_name);
            expect(res.body.user_name).to.eql(newUser.user_name);
            expect(res.body.user_email).to.eql(newUser.user_email);
            expect(res.body).to.not.have.property("password");
            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`);
            const expectedDate = new Date().toLocaleString();
            const actualDate = new Date(res.body.date_created).toLocaleString();
            expect(actualDate).to.eql(expectedDate);
          })
          .expect(res =>
            db
              .from("hive_users")
              .select("*")
              .where({ id: res.body.id })
              .first()
              .then(row => {
                expect(row.first_name).to.eql(newUser.first_name);
                expect(row.user_name).to.eql(newUser.user_name);
                expect(row.user_email).to.eql(newUser.user_email);
                const expectedDate = new Date().toLocaleString();
                const actualDate = new Date(row.date_created).toLocaleString();
                expect(actualDate).to.eql(expectedDate);

                return bcrypt.compare(newUser.password, row.password);
              })
              .then(compareMatch => {
                expect(compareMatch).to.be.true;
              })
          );
      });
    });
  });
});
