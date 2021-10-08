#!/usr/bin/env node

import { getArgsToVarsStr, getFieldArgsDict, getVarsToTypesStr, moduleConsole } from "./utils";

/**
 * Generate the query for the specified field
 * @param field executable schema representative
 * @param rootSkeleton Object representation of fields in interest
 * @param kind of query - Actual Query or Mutation, Subscription
 * @param depthLimit
 * @param dedupe function to resolve query variables conflicts
 */
export const generateQuery = ({
	                              field: rootField,
	                              skeleton: rootSkeleton,
	                              kind = 'Query',
	                              depthLimit,
	                              dedupe = getFieldArgsDict
}) => {

	/**
	 * Generate the query for the specified field
	 * @param field executable schema representative
	 * @param skeleton Object representation of fields in interest
	 * @param parentName parent name of the current field
	 * @param argumentsDict dictionary of arguments from all fields
	 * @param duplicateArgCounts map for deduping argument name collisions
	 * @param crossReferenceKeyList list of the cross reference
	 * @param curDepth current depth of field
	 * @param path
	 */
	const generateQueryRecursive = ({
		                                field,
		                                skeleton,
		                                parentName,
		                                argumentsDict = {},
		                                duplicateArgCounts = {},
		                                crossReferenceKeyList = [], // [`${parentName}To${curName}Key`]
		                                curDepth = 1,
		                                path = []
	                                }) => {
		let curType = field.type;
		while (curType.ofType) curType = curType.ofType;

		let queryStr = '';
		let childQuery = '';

		if (curType.getFields) {
			const crossReferenceKey = `${parentName}To${field.name}Key`;
			if (crossReferenceKeyList.indexOf(crossReferenceKey) !== -1 || curDepth > depthLimit) return '';
			crossReferenceKeyList.push(crossReferenceKey);
			const children = curType.getFields();
			childQuery = Object.entries(children);
			if (skeleton) {
				const skeletonKeys = Object.keys(skeleton);
				childQuery = childQuery
					.filter(([key]) => skeletonKeys.indexOf(key) !== -1)
			} else skeleton = {};
			childQuery = childQuery
				.map(([key, childField]) => generateQueryRecursive({
					field: childField,
					skeleton: skeleton[key],
					parentName: field.name,
					argumentsDict,
					duplicateArgCounts,
					crossReferenceKeyList,
					curDepth: curDepth + 1,
					path: path.concat(field.name)
				}).queryStr)
				.filter(cur => cur)
				.join('\n');
		}

		if (!(curType.getFields && !childQuery)) {
			queryStr = `${'    '.repeat(curDepth)}${field.name}`;
			if (field.args.length > 0) {
				const dict = dedupe(field, duplicateArgCounts, argumentsDict, path);
				Object.assign(argumentsDict, dict);
				queryStr += `(${getArgsToVarsStr(dict)})`;
			}
			if (childQuery) {
				queryStr += `{\n${childQuery}\n${'    '.repeat(curDepth)}}`;
			}
		}

		/* Union types */
		if (curType.astNode && curType.astNode.kind === 'UnionTypeDefinition') {
			const types = curType.getTypes();
			if (types && types.length) {
				const indent = `${'    '.repeat(curDepth)}`;
				const fragIndent = `${'    '.repeat(curDepth + 1)}`;
				queryStr += '{\n';

				types.forEach(type => {
					let unionChildQuery = Object.entries(type.getFields());
					if (skeleton && Object.keys(skeleton).length) {
						const skeletonKeys = Object.keys(skeleton);
						unionChildQuery = unionChildQuery
							.filter(([key]) => skeletonKeys.indexOf(key) !== -1)
					} else skeleton = {};
					unionChildQuery = unionChildQuery
						.map(([key, childField]) => generateQueryRecursive({
							field: childField,
							skeleton: skeleton[key],
							parentName: field.name,
							argumentsDict,
							duplicateArgCounts,
							crossReferenceKeyList,
							curDepth: curDepth + 2,
							path: path.concat(field.name)
						}).queryStr)
						.filter(cur => cur)
						.join('\n');
					queryStr += `${fragIndent}... on ${type.name} {\n${unionChildQuery}\n${fragIndent}}\n`;
				});
				queryStr += `${indent}}`;
			}
		}
		return { queryStr, argumentsDict };
	};

	return wrapQueryIntoKindDeclaration(kind, rootField, generateQueryRecursive({
		field: rootField,
		skeleton: rootSkeleton,
		parentName: kind
	}));
};

function wrapQueryIntoKindDeclaration(kind, alias, queryResult) {
	const varsToTypesStr = getVarsToTypesStr(queryResult.argumentsDict);
	const query = queryResult.queryStr;
	return `${kind.toLowerCase()} ${alias.name}${varsToTypesStr ? `(${varsToTypesStr})` : ''}{\n${query}\n}`;
}

export function generateAll(schema, depthLimit = 100, dedupe = getFieldArgsDict) {

	const result = {};

	const QUERY_KINDS_MAP = {
		Query: 'queries',
		Mutation: 'mutations',
		Subscription: 'subscriptions'
	};

	/**
	 * Generate the query for the specified field
	 * @param obj one of the root objects(Query, Mutation, Subscription)
	 * @param description description of the current object
	 */
	const addToResult = (obj, description) => {
		const kind = QUERY_KINDS_MAP[description] ||
			moduleConsole.warn(`unknown description string: ${description}`) ||
			`${String(description).toLowerCase()}s`;
		result[kind] = {};
		Object.entries(obj).forEach(([type, field]) => {
			result[kind][type] = generateQuery({ field, kind: description, parentName: description, depthLimit, dedupe });
		});
	};

	if (schema.getMutationType()) {
		addToResult(schema.getMutationType().getFields(), 'Mutation');
	} else {
		moduleConsole.warn('No mutation type found in your schema');
	}

	if (schema.getQueryType()) {
		addToResult(schema.getQueryType().getFields(), 'Query');
	} else {
		moduleConsole.warn('No query type found in your schema');
	}

	if (schema.getSubscriptionType()) {
		addToResult(schema.getSubscriptionType().getFields(), 'Subscription');
	} else {
		moduleConsole.warn('No subscription type found in your schema');
	}

	return result;
}
