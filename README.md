# gql-generator-node
![CI](https://github.com/Skitionek/gql-generator-node/workflows/CI/badge.svg)
![Unit tests](https://github.com/Skitionek/gql-generator-node/workflows/Unit%20tests/badge.svg)
![Lint](https://github.com/Skitionek/gql-generator-node/workflows/Lint/badge.svg)
![Coverage](https://github.com/Skitionek/gql-generator-node/workflows/Coverage/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Generate queries based on GraphQL schema.

```bash
npm install gql-generator-node --save-dev 
```

## ToC
- [Functionality](#functionality)
- [Features](#features)
- [Usage](#usage)
- [Advanced usage](#advanced-usage)
  * [Generate single query](#generate-single-query)
  * [Limit query fields](#limit-query-fields)
  * [Custom dedupe](#custom-dedupe)
- [Example use case](#example-use-case)
- [Notes](#notes)
- [Credits](#credits)
- [Contribution](#contribution)

## Functionality

Given any schema:
```gql
type Query {
  user(id: Int!): User!
}

type User {
  id: Int!
  username: String!
  email: String!
  createdAt: String!
}
```

this library automatically creates queries like:
```gql
query user($id: Int!) {
  user(id: $id){
    id
    username
    email
    createdAt
  }
}
```

## Features

It supports all query types:
+ Query
+ Mutation
+ Subscription 

as well as all fields descriptors, including unions, interfaces and fragments.

Last but not least it addresses corner cases - like circular reference.

## Usage
The most basic usage is to generate all queries at once by passing schema to generateAll function:
```js
import {generateAll} from 'gql-generator-node';
const {queries, mutations, subscriptions} = generateAll(schema);

console.log(mutations.signup);
/*
mutation signup($username: String!, email: String!, password: String!){
  signup(username: $username, email: $email, password: $password){
    token
    user {
      id
      username
      email
      createdAt
    }
  }
}
*/
```

## Advanced usage 

### Generate single query
```js
import {generateQuery} from "gql-generator-node";

const query = generateQuery({
    field: schema
        .getQueryType()
        .getFields().user
})

console.log(query);
/*
	Query user($user_context_user_details_region_language: String, $user_details_region_language: String, $id: Int!){
	    user(id: $id){
	        id
	        username
	        email
	        createdAt
	        context{
	            user{
	                id
	                username
	                email
	                createdAt
	                details{
	                    ... on Guest {
	                        region(language: $user_context_user_details_region_language)
	                    }
	                    ... on Member {
	                        address
	                    }
	                }
	            }
	            domain
	        }
	        details{
	            ... on Guest {
	                region(language: $user_details_region_language)
	            }
	            ... on Member {
	                address
	            }
	        }
	    }
	}
*/
```
### Limit query fields
By default query is generated with all nested fields (skipping only circular references), however this behavior can be customised by passing skeleton of object we are interested in.
For instance:
```js
const query = generateQuery({
    field: schema
        .getQueryType()
        .getFields().user,
    skeleton: {
        'email':
            true
    }
})

console.log(query);
/*
	Query user($id: Int!){
	    user(id: $id){
	        email
	    }
	}
*/
```

### Custom dedupe

As default top variables names correspond to schema while nested ones can be addressed by the path - so all of them can be addressed independently in a declarative way.
Ex:
```graphql
mutation signup($signup_user_context_user_details_region_language: String, $signup_user_details_region_language: String, $email: String!, $username: String!, $password: String!){
    signup(email: $email, username: $username, password: $password){
        token
        user{
            id
            username
            email
            createdAt
            context{
                user{
                    id
                    username
                    email
                    createdAt
                    details{
                        ... on Guest {
                            region(language: $signup_user_context_user_details_region_language)
                        }
                        ... on Member {
                            address
                        }
                    }
                }
                domain
            }
            details{
                ... on Guest {
                    region(language: $signup_user_details_region_language)
                }
                ... on Member {
                    address
                }
            }
        }
    }
}
```
Yet some applications might take advantage of custom dedupe functions to for instance to send same argument to all sub fields using same name:
```js
gqlGenerator(schema,depth,({args})=>{
        const o = {};
        (args || []).forEach(arg=>{
            o[arg.name] = arg;
        });
        return o;
    })
```
=>
```graphql
mutation signup($language: String, $email: String!, $username: String!, $password: String!){
    signup(email: $email, username: $username, password: $password){
        token
        user{
            id
            username
            email
            createdAt
            context{
                user{
                    id
                    username
                    email
                    createdAt
                    details{
                        ... on Guest {
                            region(language: $language)
                        }
                        ... on Member {
                            address
                        }
                    }
                }
                domain
            }
            details{
                ... on Guest {
                    region(language: $language)
                }
                ... on Member {
                    address
                }
            }
        }
    }
}
```

## Example use case
I personally use it to write graphql endpoints tests.

Assuming GraphQL schema: 
```gql
type Mutation {
  signup(
    email: String!
    username: String!
    password: String!
  ): UserToken!
}

type UserToken {
  token: String!
  user: User!
}

type User {
  id: Int!
  username: String!
  email: String!
  createdAt: String!
}
```

Before this tool, one needed to write GraphQL API test like this:

```js
test('signup', async () => {
  const query = `mutation signup($username: String!, email: String!, password: String!){
    signup(username: $username, email: $email, password: $password){
      token
      user {
        id
        username
        email
        createdAt
      }
    }
  }`;

  return graphql(query);
});
```

As `gqlGenerator` can generate queries, above test becomes:

```js
const {queries} = generateAll(schema.getMutationType().signup);

const variables = { username: "I", email: "best_developer@testing.org", password: '1234' };

test.each(Object.entries(queries))('%s', async ([name,query]) => 
  graphql(query,{variables})
);
```

It not only greatly simplifies testing which might be now automated and batched but also ensures that you would never miss the field to test. Last but not least there is no code duplication between schema and test so most schema updates does not force tests update. 


## Notes
 
- Variable names are derived from argument names, so variables generated from multiple occurrences of the same argument name must be deduped. By default, subtree arguments are given path prefix (ex. can be found in dedupe description).

## Credits
 
Code has has its origins at [modelo/gql-generator](https://github.com/modelo/gql-generator), however it greatly diverged from this implementation.

## Contribution 

Please feel free open the issues! Although the current stage satisfies my application usage, I would be happy to provide help and improvements if there will be a need for it.
Also you can gratify it with star, if you find it useful.
