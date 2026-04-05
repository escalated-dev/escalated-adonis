import {
  E_INVALID_CREDENTIALS
} from "../../chunk-MUPAP5IP.js";
import {
  __decorateClass
} from "../../chunk-UXA4FHST.js";

// src/mixins/lucid.ts
import { RuntimeException } from "@adonisjs/core/exceptions";
import { beforeSave } from "@adonisjs/lucid/orm";
function withAuthFinder(hash, options) {
  return function(superclass) {
    class UserWithUserFinder extends superclass {
      static async hashPassword(user) {
        if (user.$dirty[options.passwordColumnName]) {
          ;
          user[options.passwordColumnName] = await hash().make(
            user[options.passwordColumnName]
          );
        }
      }
      /**
       * Finds the user for authentication via "verifyCredentials".
       * Feel free to override this method customize the user
       * lookup behavior.
       */
      static findForAuth(uids, value) {
        const query = this.query();
        uids.forEach((uid) => query.orWhere(uid, value));
        return query.limit(1).first();
      }
      /**
       * Find a user by uid and verify their password. This method is
       * safe from timing attacks.
       */
      static async verifyCredentials(uid, password) {
        if (!uid || !password) {
          throw new E_INVALID_CREDENTIALS("Invalid user credentials");
        }
        const user = await this.findForAuth(options.uids, uid);
        if (!user) {
          await hash().make(password);
          throw new E_INVALID_CREDENTIALS("Invalid user credentials");
        }
        if (await user.verifyPassword(password)) {
          return user;
        }
        throw new E_INVALID_CREDENTIALS("Invalid user credentials");
      }
      /**
       * Verifies the plain password against the user's password
       * hash
       */
      verifyPassword(plainPassword) {
        const passwordHash = this[options.passwordColumnName];
        if (!passwordHash) {
          throw new RuntimeException(
            `Cannot verify password. The value for "${options.passwordColumnName}" column is undefined or null`
          );
        }
        return hash().verify(passwordHash, plainPassword);
      }
    }
    __decorateClass([
      beforeSave()
    ], UserWithUserFinder, "hashPassword", 1);
    return UserWithUserFinder;
  };
}
export {
  withAuthFinder
};
